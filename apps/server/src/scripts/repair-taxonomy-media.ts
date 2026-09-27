import { db } from '@project/db'
import { auditTaxonomyMedia } from './taxonomyMediaAudit'

// Fixes what audit-media.ts reports, database-side only. Dry run by default;
// pass --apply to write. Run inside the server container so file checks see
// the real volume, then re-run media-sync.ts there to re-import.
//
//   - unservable/missing-file/wrong-identity assets: row deleted (files are
//     left alone — the uploads directory also holds profile photos)
//   - entities left without a primary: promote a servable asset, else clear imageUrl
//   - stale Wikidata refs: set to the reviewed fixture QID
//   - refs to retired (known-wrong) QIDs: deleted
const apply = process.argv.includes('--apply')

async function main() {
  const actor = await db.user.findFirst({ where: { role: 'ADMIN' } })
  if (!actor) throw new Error('Seed an ADMIN user first')
  const audit = await auditTaxonomyMedia()
  const { assetFindings, refFindings, deadEntityImages } = audit

  const deleteIds = assetFindings.map((f) => f.assetId)
  const touchedEntities = new Set([...assetFindings.map((f) => f.entityId), ...deadEntityImages.map((d) => d.entityId)].filter((id): id is string => !!id))
  const plan = {
    mode: apply ? 'APPLY' : 'DRY RUN',
    before: audit.summary,
    deleteAssets: countBy(assetFindings.map((f) => f.problem)),
    wrongIdentity: assetFindings.filter((f) => f.problem === 'wrong-identity').map((f) => `${f.label}: ${f.sourceId} -> ${f.expectedQid}`),
    fixRefs: refFindings.filter((f) => f.problem === 'stale-ref').map((f) => `${f.label}: ${f.externalId} -> ${f.expectedQid}`),
    deleteRefs: refFindings.filter((f) => f.problem === 'retired-qid').map((f) => `${f.label}: ${f.externalId}`),
    entitiesToReconcile: touchedEntities.size,
  }
  console.log(JSON.stringify(plan, null, 2))
  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to perform the above.')
    return
  }

  await db.$transaction(async (tx) => {
    await tx.mediaAsset.deleteMany({ where: { id: { in: deleteIds } } })
    for (const f of refFindings) {
      if (f.problem === 'stale-ref') await tx.entityExternalRef.update({ where: { id: f.refId }, data: { externalId: f.expectedQid!, metadata: undefined } })
      else await tx.entityExternalRef.delete({ where: { id: f.refId } })
    }
  }, { timeout: 60_000 })

  // Re-derive each touched entity's image from whatever servable asset remains.
  const servableIds = new Set<string>()
  const after = await auditTaxonomyMedia()
  const stillBad = new Set(after.assetFindings.map((f) => f.assetId))
  for (const entityId of touchedEntities) {
    const remaining = await db.mediaAsset.findMany({ where: { entityId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] })
    const keep = remaining.find((a) => !stillBad.has(a.id))
    await db.$transaction([
      db.mediaAsset.updateMany({ where: { entityId, isPrimary: true, ...(keep ? { id: { not: keep.id } } : {}) }, data: { isPrimary: false } }),
      ...(keep ? [db.mediaAsset.update({ where: { id: keep.id }, data: { isPrimary: true } })] : []),
      db.entity.update({ where: { id: entityId }, data: { imageUrl: keep?.publicUrl ?? null } }),
    ])
    if (keep) servableIds.add(keep.id)
  }

  await db.adminAuditEvent.create({
    data: {
      actorUserId: actor.id, actorRole: actor.role, action: 'repair_taxonomy_media', targetType: 'media_asset', targetId: null,
      beforeValue: audit.summary as any,
      afterValue: { deletedAssets: deleteIds.length, fixedRefs: plan.fixRefs.length, deletedRefs: plan.deleteRefs.length, reconciledEntities: touchedEntities.size, promotedAssets: servableIds.size },
    },
  })
  const final = await auditTaxonomyMedia()
  console.log('\nAfter repair:')
  console.log(JSON.stringify(final.summary, null, 2))
  console.log('\nNext: re-import inside the container — src/scripts/media-sync.ts (repeat until remaining is 0).')
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {})
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
