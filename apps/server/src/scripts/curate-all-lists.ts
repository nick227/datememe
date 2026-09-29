import { mkdirSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { db, type Prisma } from '@project/db'
import { TaxonomyService } from '../services/TaxonomyService'

// One-off migration (2026-09-29, applied to production): every List gets an
// explicit, editable pool. Each non-CURATED list (a legacy "every value of its
// type/tags" list) is resolved the way the list builder resolved it until then
// (legacyPool, kept here because the app no longer knows that mode),
// snapshotted into CategoryEntity in that order, and switched to CURATED. The
// list is re-resolved with today's resolver afterwards and rolled back if what
// users see changed at all.
// DB-only; dry run unless --apply:
//
//   DATABASE_URL=<target> pnpm --filter server exec tsx src/scripts/curate-all-lists.ts [--apply]
//
// Saved picks the resolver doesn't show but that are valid to save today (the
// old save check ignored tags, so "Top 90s Bands" accepted any band) are kept
// in the pool, after the resolved values, so no saved list stops saving. The
// check afterwards allows exactly those additions and nothing else.
const apply = process.argv.includes('--apply')
const NO_VIEWER = '__curate-all-lists__' // a profile id that owns no pending values → approved values only
const taxonomy = new TaxonomyService()

/** What the list builder showed a non-CURATED list before 2026-09-29, in the same order. */
async function legacyPool(categoryId: string) {
  const c = await db.category.findUniqueOrThrow({ where: { id: categoryId }, select: { entityTypeId: true, requiredTags: { select: { tagId: true } } } })
  const tagFilters: Prisma.EntityWhereInput[] = c.requiredTags.map((t) => ({ tags: { some: { tagId: t.tagId } } }))
  const rows = await db.entity.findMany({
    where: {
      entityTypeId: c.entityTypeId, status: 'APPROVED', mergedIntoId: null,
      curatedForCategories: { none: { categoryId, isExcluded: true } },
      ...(tagFilters.length ? { OR: [{ AND: tagFilters }, { curatedForCategories: { some: { categoryId, isExcluded: false } } }] } : {}),
    },
    orderBy: [{ status: 'asc' }, { usageCount: 'desc' }, { canonicalName: 'asc' }],
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

async function resolve(slug: string) {
  const ids: string[] = []
  let cursor: string | undefined
  do {
    const page = await taxonomy.searchCategoryEntities(slug, NO_VIEWER, { limit: 100, cursor })
    ids.push(...page.data.map((e) => e.id))
    cursor = page.meta.nextCursor ?? undefined
  } while (cursor)
  return ids
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i])

async function main() {
  const lists = await db.category.findMany({
    where: { poolMode: { not: 'CURATED' } },
    select: { id: true, slug: true, isActive: true, poolMode: true, entityTypeId: true, curatedEntities: { select: { entityId: true, sortOrder: true, isExcluded: true } } },
    orderBy: { slug: 'asc' },
  })
  const backup: unknown[] = []
  let converted = 0, failed = 0

  for (const l of lists) {
    const before = await legacyPool(l.id)
    const pool = new Set(before)
    const picks = await db.listItem.findMany({ where: { list: { categoryId: l.id } }, select: { entityId: true, list: { select: { profileId: true } } } })
    const excluded = new Set(l.curatedEntities.filter((r) => r.isExcluded).map((r) => r.entityId))
    const keep: string[] = []
    let approvedKept = 0
    for (const p of picks) {
      if (pool.has(p.entityId) || keep.includes(p.entityId) || excluded.has(p.entityId)) continue
      // Valid to save today = what ListService.upsertMyList accepts for this owner.
      const e = await db.entity.findFirst({
        where: { id: p.entityId, entityTypeId: l.entityTypeId, mergedIntoId: null, OR: [{ status: 'APPROVED' }, { status: { in: ['PENDING', 'REJECTED'] }, submittedByProfileId: p.list.profileId }] },
        select: { status: true },
      })
      if (!e) continue
      keep.push(p.entityId)
      if (e.status === 'APPROVED') approvedKept++
    }
    const note = `${l.slug}${l.isActive ? '' : ' (hidden)'}: ${before.length} values${keep.length ? ` + ${keep.length} saved pick(s) kept (${approvedKept} approved)` : ''}`
    if (!before.length) { console.log(`skip  ${note} — resolves to nothing, left as is`); continue }
    if (!apply) { console.log(`would ${note}`); continue }

    backup.push({ id: l.id, slug: l.slug, poolMode: l.poolMode, rows: l.curatedEntities })
    await db.$transaction(async (tx) => {
      for (const [sortOrder, entityId] of [...before, ...keep].entries()) {
        await tx.categoryEntity.upsert({
          where: { categoryId_entityId: { categoryId: l.id, entityId } },
          create: { categoryId: l.id, entityId, sortOrder },
          update: { sortOrder, isExcluded: false },
        })
      }
      await tx.category.update({ where: { id: l.id }, data: { poolMode: 'CURATED' } })
    }, { timeout: 120_000 })

    // Unchanged = the resolved values, in the same order, plus only the kept approved picks.
    const after = await resolve(l.slug)
    const allowed = new Set([...before, ...keep])
    const unchanged = same(before, after.filter((id) => pool.has(id))) && after.every((id) => allowed.has(id)) && after.length === before.length + approvedKept
    if (unchanged) { converted++; console.log(`done  ${note}`); continue }

    // Visible pool changed: put the list back exactly as it was.
    await db.$transaction(async (tx) => {
      await tx.categoryEntity.deleteMany({ where: { categoryId: l.id } })
      if (l.curatedEntities.length) await tx.categoryEntity.createMany({ data: l.curatedEntities.map((r) => ({ categoryId: l.id, ...r })) })
      await tx.category.update({ where: { id: l.id }, data: { poolMode: l.poolMode } })
    })
    failed++
    console.log(`FAIL  ${note} — ${before.length} → ${after.length} after snapshot; rolled back`)
  }

  if (apply && backup.length) {
    const dir = join(homedir(), 'datememe-backups')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `curate-all-lists-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    writeFileSync(file, JSON.stringify(backup, null, 2))
    console.log(`pre-migration pool modes and rows: ${file}`)
  }
  console.log(`CURATE_ALL ${JSON.stringify({ mode: apply ? 'apply' : 'dry-run', nonCurated: lists.length, converted, failed })}`)
  if (failed) process.exitCode = 1
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => db.$disconnect())
