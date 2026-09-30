import { writeFileSync } from 'fs'
import { db } from '../packages/db/src/client'
import { key } from '../apps/server/src/lib/identityKey'
import { loadCatalog, serializeCatalogFile, type CatalogFile, type Entry } from './lib/listsDb'

// One-off catalog cleanup after the 2026-09-30 fill batches (docs/list-values-runbook.md).
// A fixed manifest, not a general tool. Dry run unless --apply. Idempotent.
//
//   DATABASE_URL=<target> pnpm exec tsx scripts/catalog-cleanup-2026-09-30.ts [--apply]
//
// merges    duplicate entities of one type: the "from" entity is merged into "into"
//           the way moderation merges (status REJECTED + mergedIntoId), and everything
//           pointing at it moves: saved picks (ListItem), list values (CategoryEntity),
//           aliases (plus its old name as an alias), usageCount.
// removals  off-type values leave one list only: the CategoryEntity row is marked
//           isExcluded (hidden everywhere, never re-added by an import); the entity
//           and users' saved picks are untouched.
// renames   a typo'd entity name; the old name stays as an alias.
// links     alsoExpands links removed from catalog entries.
// The catalog entries of every touched list are edited to match (--apply), so a
// later publish can't re-add or re-create anything.

const MERGES = [
  { list: 'primary-web-browser', from: 'Chrome', into: 'Google Chrome' },
  { list: 'primary-web-browser', from: 'Mozilla Firefox', into: 'Firefox' },
  { list: 'favorite-game-consoles', from: 'Super Nintendo (SNES)', into: 'Super Nintendo' },
  { list: 'essential-streaming-services', from: 'Max', into: 'HBO Max' },
  { list: 'essential-streaming-services', from: 'Amazon Prime Video', into: 'Prime Video' },
]
const REMOVALS = [
  { list: 'essential-streaming-services', values: ['Spotify', 'Apple Music'] },
  { list: 'top-hiphop-artists', values: ['Pearl Jam', 'No Doubt', 'Bruno Mars', 'Radiohead', 'The Smashing Pumpkins', 'R.E.M.', 'Dua Lipa'] },
  { list: 'top-90s-bands', values: ['Kanye West', 'Alicia Keys', 'MGMT', 'Ariana Grande', 'Katy Perry', 'Billie Eilish', 'J. Cole', 'Dua Lipa'] },
  { list: 'top-anime-series', values: ['Spirited Away', 'Ninja Scroll'] },
  { list: 'top-documentaries', values: ['Planet Earth', 'The Last Dance'] },
  { list: 'favorite-edutubers', values: ['MrBeast'] },
  { list: 'bedtime-routine', values: ['Meditation', 'Audio Book'] },
  // Pulled into Books by Mind-Expanding Books' alsoExpands; they stay in Mind-Expanding Books.
  { list: 'favorite-books', values: ['Be Here Now', 'Confessions of an English Opium-Eater', 'DMT: The Spirit Molecule', 'Food of the Gods', 'How to Change Your Mind', 'The Psychedelic Experience', 'The Teachings of Don Juan', 'PiHKAL', 'TiHKAL', 'The Psychedelic Explorer\'s Guide', 'Acid Dreams', 'Storming Heaven', 'Breaking Open the Head', 'The Immortality Key'] },
]
const RENAMES = [
  { list: 'favorite-political-podcasts', from: 'Chap Trap House', to: 'Chapo Trap House' },
]
const UNLINK = [
  { list: 'mind-expanding-books', alsoExpands: 'Books' },
]

const apply = process.argv.includes('--apply')
const out: string[] = []
const say = (s: string) => out.push(s)
const problems: string[] = []

type Cat = { id: string; slug: string; shortLabel: string; entityTypeId: string }
const cats = new Map<string, Cat>()
async function cat(slug: string) {
  if (!cats.has(slug)) {
    const c = await db.category.findUnique({ where: { slug }, select: { id: true, slug: true, shortLabel: true, entityTypeId: true } })
    if (!c) throw new Error(`no list ${slug}`)
    cats.set(slug, c)
  }
  return cats.get(slug)!
}
/** The live (unmerged) entity of this list's type with exactly this name. */
const entity = (c: Cat, name: string) => db.entity.findFirst({ where: { entityTypeId: c.entityTypeId, canonicalName: name, mergedIntoId: null }, select: { id: true, canonicalName: true, usageCount: true } })
/** Values a list offers, as the app shows them. */
const offered = async (categoryId: string) => new Set((await db.categoryEntity.findMany({
  where: { categoryId, isExcluded: false, entity: { mergedIntoId: null, status: 'APPROVED' } }, select: { entityId: true },
})).map((r) => r.entityId))

async function main() {
  const touched = new Set<string>([...MERGES, ...REMOVALS, ...RENAMES, ...UNLINK].map((x) => x.list))
  const before = new Map<string, number>()
  for (const slug of touched) before.set(slug, (await offered((await cat(slug)).id)).size)
  // Predicted "after" for a dry run: each list's offered set with the manifest applied.
  const predicted = new Map<string, Set<string>>()
  for (const slug of touched) predicted.set(slug, await offered((await cat(slug)).id))
  const fileEdits: { list: string; remove?: string[]; replace?: [string, string]; unlink?: string }[] = []

  say('MERGES')
  for (const m of MERGES) {
    const c = await cat(m.list)
    const into = await entity(c, m.into)
    const from = await entity(c, m.from)
    if (!into) { problems.push(`merge ${m.from} → ${m.into}: no "${m.into}" in ${m.list}'s type`); continue }
    if (!from) {
      const done = await db.entity.findFirst({ where: { entityTypeId: c.entityTypeId, canonicalName: m.from, mergedIntoId: into.id } })
      done ? say(`  = ${m.from} → ${m.into}: already merged`) : problems.push(`merge ${m.from} → ${m.into}: no "${m.from}"`)
      fileEdits.push({ list: m.list, replace: [m.from, m.into] })
      continue
    }
    const items = await db.listItem.findMany({ where: { entityId: from.id }, select: { id: true, listId: true } })
    const clash = new Set((await db.listItem.findMany({ where: { entityId: into.id, listId: { in: items.map((i) => i.listId) } }, select: { listId: true } })).map((i) => i.listId))
    const rows = await db.categoryEntity.findMany({ where: { entityId: from.id }, select: { categoryId: true, sortOrder: true, isExcluded: true, category: { select: { slug: true } } } })
    const intoRows = new Set((await db.categoryEntity.findMany({ where: { entityId: into.id, categoryId: { in: rows.map((r) => r.categoryId) } }, select: { categoryId: true } })).map((r) => r.categoryId))
    const aliases = await db.entityAlias.findMany({ where: { entityId: from.id }, select: { id: true, alias: true } })
    say(`  ${m.from} → ${m.into} (${m.list})`)
    say(`      saved picks: ${items.length} move${clash.size ? `, of which ${clash.size} dropped (that list already has ${m.into})` : ''}`)
    say(`      list values: ${rows.map((r) => `${r.category.slug}${intoRows.has(r.categoryId) ? ' (already has target: row dropped)' : ' (moved)'}`).join(', ') || 'none'}`)
    say(`      aliases: "${m.from}" added${aliases.length ? `, ${aliases.length} moved` : ''}; usageCount ${into.usageCount} + ${from.usageCount}`)
    for (const r of rows) {
      const p = predicted.get(r.category.slug)
      if (p) { p.delete(from.id); if (!r.isExcluded) p.add(into.id) }
    }
    fileEdits.push({ list: m.list, replace: [m.from, m.into] })
    if (!apply) continue
    await db.$transaction(async (tx) => {
      for (const i of items) {
        if (clash.has(i.listId)) await tx.listItem.delete({ where: { id: i.id } })
        else await tx.listItem.update({ where: { id: i.id }, data: { entityId: into.id } })
      }
      for (const r of rows) {
        await tx.categoryEntity.delete({ where: { categoryId_entityId: { categoryId: r.categoryId, entityId: from.id } } })
        if (!intoRows.has(r.categoryId)) await tx.categoryEntity.create({ data: { categoryId: r.categoryId, entityId: into.id, sortOrder: r.sortOrder, isExcluded: r.isExcluded } })
      }
      const intoAliases = new Set((await tx.entityAlias.findMany({ where: { entityId: into.id }, select: { alias: true } })).map((a) => a.alias))
      for (const a of aliases) {
        if (intoAliases.has(a.alias)) await tx.entityAlias.delete({ where: { id: a.id } })
        else { await tx.entityAlias.update({ where: { id: a.id }, data: { entityId: into.id } }); intoAliases.add(a.alias) }
      }
      if (!intoAliases.has(m.from)) await tx.entityAlias.create({ data: { entityId: into.id, alias: m.from } })
      await tx.entity.update({ where: { id: into.id }, data: { usageCount: { increment: from.usageCount } } })
      // Same convention as moderation's merge (adminModeration.ts): REJECTED + mergedIntoId.
      await tx.entity.update({ where: { id: from.id }, data: { status: 'REJECTED', mergedIntoId: into.id, usageCount: 0 } })
    }, { timeout: 120_000, maxWait: 30_000 }) // generous: the Railway proxy is slow and each merge is a few dozen queries
  }

  say('REMOVALS (list only; entity and saved picks kept)')
  for (const r of REMOVALS) {
    const c = await cat(r.list)
    const lines: string[] = []
    for (const name of r.values) {
      const e = await entity(c, name)
      const row = e && await db.categoryEntity.findUnique({ where: { categoryId_entityId: { categoryId: c.id, entityId: e.id } }, select: { isExcluded: true } })
      if (!e || !row) { problems.push(`remove "${name}" from ${r.list}: not on the list`); continue }
      if (row.isExcluded) { lines.push(`${name} (already)`); continue }
      const picks = await db.listItem.count({ where: { entityId: e.id, list: { categoryId: c.id } } })
      lines.push(`${name}${picks ? ` [${picks} saved pick${picks > 1 ? 's' : ''}]` : ''}`)
      predicted.get(r.list)!.delete(e.id)
      if (apply) await db.categoryEntity.update({ where: { categoryId_entityId: { categoryId: c.id, entityId: e.id } }, data: { isExcluded: true } })
    }
    say(`  ${r.list}: ${lines.join(' | ')}`)
    fileEdits.push({ list: r.list, remove: r.values })
  }

  say('RENAMES')
  for (const r of RENAMES) {
    const c = await cat(r.list)
    const e = await entity(c, r.from)
    if (!e) {
      (await entity(c, r.to)) ? say(`  = ${r.from} → ${r.to}: already renamed`) : problems.push(`rename "${r.from}": not found`)
    } else {
      const clash = await db.entity.findFirst({ where: { entityTypeId: c.entityTypeId, slug: key(r.to), NOT: { id: e.id } } })
      if (clash) { problems.push(`rename "${r.from}" → "${r.to}": slug ${key(r.to)} is taken`); continue }
      say(`  ${r.from} → ${r.to} (slug ${key(r.to)}; "${r.from}" kept as an alias)`)
      if (apply) await db.$transaction([
        db.entity.update({ where: { id: e.id }, data: { canonicalName: r.to, slug: key(r.to) } }),
        db.entityAlias.upsert({ where: { entityId_alias: { entityId: e.id, alias: r.from } }, update: {}, create: { entityId: e.id, alias: r.from } }),
      ])
    }
    fileEdits.push({ list: r.list, replace: [r.from, r.to] })
  }

  say('LINKS')
  for (const u of UNLINK) { say(`  ${u.list}: drop alsoExpands "${u.alsoExpands}" (catalog entry)`); fileEdits.push({ list: u.list, unlink: u.alsoExpands }) }

  // Catalog entries: every touched list must have exactly one pinned entry.
  const files = loadCatalog()
  const changed = new Set<CatalogFile>()
  const nameOf = (v: unknown) => (typeof v === 'string' ? v : (v as { name: string }).name)
  for (const edit of fileEdits) {
    const hits = files.flatMap((f) => f.entries.map((e) => ({ f, e }))).filter(({ e }) => e.categorySlug === edit.list)
    if (hits.length !== 1) { problems.push(`${edit.list}: ${hits.length} pinned catalog entries (run prod:list-stub --list ${edit.list})`); continue }
    const { f, e } = hits[0]!
    const before = JSON.stringify(e)
    let values = (e.values as unknown[]) ?? []
    if (edit.remove) values = values.filter((v) => !edit.remove!.includes(nameOf(v)))
    if (edit.replace) {
      const [from, to] = edit.replace
      const hasTo = values.some((v) => nameOf(v) === to)
      values = hasTo ? values.filter((v) => nameOf(v) !== from) : values.map((v) => (nameOf(v) === from ? to : v))
    }
    ;(e as Entry).values = values
    if (edit.unlink && Array.isArray(e.alsoExpands)) {
      const rest = (e.alsoExpands as string[]).filter((t) => t !== edit.unlink)
      if (rest.length) e.alsoExpands = rest
      else delete e.alsoExpands
    }
    if (JSON.stringify(e) !== before) changed.add(f)
  }
  if (apply) for (const f of changed) writeFileSync(f.path, serializeCatalogFile(f))

  say('VALUE COUNTS (before → after)')
  for (const slug of touched) {
    const after = apply ? (await offered((await cat(slug)).id)).size : predicted.get(slug)!.size
    say(`  ${slug}: ${before.get(slug)} → ${after}${after < 20 ? '  (shallow — fill next)' : ''}`)
  }
  say(`CATALOG FILES: ${[...changed].map((f) => f.name).join(', ') || 'none'}${apply ? ' (written)' : ' (would change)'}`)

  console.log(out.join('\n'))
  if (problems.length) console.log(`\nPROBLEMS\n  ${problems.join('\n  ')}`)
  console.log(apply ? '\nApplied.' : '\nDry run — nothing written. Re-run with --apply.')
  if (problems.length) process.exitCode = 1
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
