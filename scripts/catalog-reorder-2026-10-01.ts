import { db } from '../packages/db/src/client'

// One-off: lead the canonical lists with their strongest answers (docs/list-values-runbook.md).
// A fixed manifest. Dry run unless --apply. Idempotent.
//
//   DATABASE_URL=<target> pnpm exec tsx scripts/catalog-reorder-2026-10-01.ts [--apply]
//
// These lists' sort positions were assigned alphabetically when legacy lists were
// snapshotted (2026-09-29), so the builder's first 20 read "13th, A Nightmare on
// Elm Street, A Silent Voice…". The importer only appends, so order is fixed here:
//
// lead     each list's 20 strongest, most common answers take positions 0-19 in
//          this order; every other value keeps its current relative order after them.
//          Sort positions only: no value or saved pick changes.
// merge    one duplicate entity, merged the way catalog-cleanup-2026-09-30 merges.
// remove   TV series in a movie list, excluded from that list only.
// Afterwards re-sync the catalog entries: pnpm prod:list-stub --list <slug>…

const LEAD: Record<string, string[]> = {
  'top-movies': ['The Godfather', 'The Shawshank Redemption', 'Pulp Fiction', 'The Dark Knight', 'Forrest Gump', 'Star Wars: Episode IV - A New Hope', 'Titanic', 'Jurassic Park', 'Back to the Future', 'The Lord of the Rings: The Fellowship of the Ring', 'Inception', 'The Matrix', 'Goodfellas', 'Fight Club', 'Raiders of the Lost Ark', 'Toy Story', 'The Lion King', 'Interstellar', 'Gladiator', 'Spirited Away'],
  'favorite-books': ['To Kill a Mockingbird', 'Harry Potter', '1984', 'Pride and Prejudice', 'The Great Gatsby', 'The Lord of the Rings', 'The Hobbit', 'The Catcher in the Rye', 'The Hunger Games', 'The Alchemist', 'Dune', 'Little Women', 'Of Mice and Men', 'Jane Eyre', 'Brave New World', 'Fahrenheit 451', 'The Book Thief', 'Gone Girl', 'The Handmaid\'s Tale', 'Crime and Punishment'],
  'top-albums': ['Thriller - Michael Jackson', 'Abbey Road - The Beatles', 'The Dark Side of the Moon - Pink Floyd', 'Rumours - Fleetwood Mac', 'Nevermind - Nirvana', 'Back in Black - AC/DC', 'Purple Rain - Prince', 'Hotel California - Eagles', 'The Miseducation of Lauryn Hill - Lauryn Hill', 'Lemonade - Beyoncé', 'To Pimp a Butterfly - Kendrick Lamar', '21 - Adele', '1989 - Taylor Swift', 'My Beautiful Dark Twisted Fantasy - Kanye West', 'OK Computer - Radiohead', 'Back to Black - Amy Winehouse', 'Illmatic - Nas', 'Blonde - Frank Ocean', 'Songs in the Key of Life - Stevie Wonder', 'Led Zeppelin IV - Led Zeppelin'],
  'favorite-video-games': ['Minecraft', 'Grand Theft Auto V', 'The Legend of Zelda: Breath of the Wild', 'Super Mario Bros.', 'Red Dead Redemption 2', 'Elden Ring', 'The Witcher 3: Wild Hunt', 'The Last of Us Part I', 'Tetris', 'Fortnite', 'Pokémon Red and Blue', 'Mario Kart 8 Deluxe', 'Super Smash Bros. Ultimate', 'The Elder Scrolls V: Skyrim', 'Call of Duty 4: Modern Warfare', 'Halo: Combat Evolved', 'The Legend of Zelda: Ocarina of Time', 'Animal Crossing: New Horizons', 'League of Legends', 'Super Mario 64'],
  'top-podcasts': ['The Joe Rogan Experience', 'The Daily', 'Call Her Daddy', 'Crime Junkie', 'SmartLess', 'Stuff You Should Know', 'This American Life', 'Armchair Expert', 'The Mel Robbins Podcast', 'New Heights', 'Huberman Lab', 'My Favorite Murder', 'Serial', 'Radiolab', 'The Diary Of A CEO', 'Conan O\'Brien Needs a Friend', 'Freakonomics Radio', 'This Past Weekend w/ Theo Von', 'Hidden Brain', 'Lex Fridman Podcast'],
  'favorite-board-games': ['Monopoly', 'Uno', 'Chess', 'Scrabble', 'Catan', 'Poker', 'Ticket to Ride', 'Cards Against Humanity', 'Codenames', 'Cluedo', 'Risk', 'Jenga', 'Trivial Pursuit', 'Dungeons & Dragons', 'Pictionary', 'The Game of Life', 'Exploding Kittens', 'Connect Four', 'Magic: The Gathering', 'Wingspan'],
  'favorite-clothing-brands': ['Nike', 'Adidas', 'Levi\'s', 'Zara', 'H&M', 'Uniqlo', 'Lululemon', 'The North Face', 'Patagonia', 'Gap', 'Converse', 'Vans', 'New Balance', 'Gucci', 'Carhartt', 'Abercrombie & Fitch', 'Supreme', 'Puma', 'Champion', 'Balenciaga'],
}
const MERGES = [{ list: 'top-movies', from: 'Star Wars: A New Hope', into: 'Star Wars: Episode IV - A New Hope' }]
const REMOVALS = [{ list: 'top-movies', values: ['Planet Earth', 'The Last Dance'] }]

const apply = process.argv.includes('--apply')
const out: string[] = []
const problems: string[] = []
type Cat = { id: string; entityTypeId: string }
const cat = async (slug: string): Promise<Cat> => {
  const c = await db.category.findUnique({ where: { slug }, select: { id: true, entityTypeId: true } })
  if (!c) throw new Error(`no list ${slug}`)
  return c
}
const entity = (c: Cat, name: string) => db.entity.findFirst({ where: { entityTypeId: c.entityTypeId, canonicalName: name, mergedIntoId: null }, select: { id: true, usageCount: true } })
/** The list as the builder shows it: offered values in sort order. */
const shown = async (c: Cat) => (await db.categoryEntity.findMany({
  where: { categoryId: c.id, isExcluded: false, entity: { mergedIntoId: null, status: 'APPROVED' } },
  orderBy: [{ sortOrder: 'asc' }, { entity: { usageCount: 'desc' } }, { entity: { canonicalName: 'asc' } }],
  select: { entityId: true, sortOrder: true, entity: { select: { canonicalName: true } } },
}))

async function main() {
  out.push('MERGES')
  for (const m of MERGES) {
    const c = await cat(m.list)
    const into = await entity(c, m.into)
    const from = await entity(c, m.from)
    if (!into) { problems.push(`merge: no "${m.into}"`); continue }
    if (!from) { out.push(`  = ${m.from} → ${m.into}: already merged`); continue }
    const items = await db.listItem.findMany({ where: { entityId: from.id }, select: { id: true, listId: true } })
    const clash = new Set((await db.listItem.findMany({ where: { entityId: into.id, listId: { in: items.map((i) => i.listId) } }, select: { listId: true } })).map((i) => i.listId))
    const rows = await db.categoryEntity.findMany({ where: { entityId: from.id }, select: { categoryId: true, sortOrder: true, isExcluded: true, category: { select: { slug: true } } } })
    const intoRows = new Set((await db.categoryEntity.findMany({ where: { entityId: into.id, categoryId: { in: rows.map((r) => r.categoryId) } }, select: { categoryId: true } })).map((r) => r.categoryId))
    const aliases = await db.entityAlias.findMany({ where: { entityId: from.id }, select: { id: true, alias: true } })
    out.push(`  ${m.from} → ${m.into}: ${items.length} saved picks move${clash.size ? ` (${clash.size} dropped: list already has the target)` : ''}; lists: ${rows.map((r) => `${r.category.slug}${intoRows.has(r.categoryId) ? ' (row dropped)' : ' (moved)'}`).join(', ')}`)
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
      await tx.entity.update({ where: { id: from.id }, data: { status: 'REJECTED', mergedIntoId: into.id, usageCount: 0 } })
    }, { timeout: 120_000, maxWait: 30_000 })
  }

  out.push('REMOVALS (list only; entity and saved picks kept)')
  for (const r of REMOVALS) {
    const c = await cat(r.list)
    for (const name of r.values) {
      const e = await entity(c, name)
      const row = e && await db.categoryEntity.findUnique({ where: { categoryId_entityId: { categoryId: c.id, entityId: e.id } }, select: { isExcluded: true } })
      if (!e || !row) { problems.push(`remove "${name}" from ${r.list}: not on the list`); continue }
      if (row.isExcluded) { out.push(`  = ${r.list}: ${name} (already)`); continue }
      const picks = await db.listItem.count({ where: { entityId: e.id, list: { categoryId: c.id } } })
      out.push(`  ${r.list}: ${name}${picks ? ` [${picks} saved picks]` : ''}`)
      if (apply) await db.categoryEntity.update({ where: { categoryId_entityId: { categoryId: c.id, entityId: e.id } }, data: { isExcluded: true } })
    }
  }

  out.push('LEAD (first 20 shown in the builder, before → after)')
  for (const [slug, lead] of Object.entries(LEAD)) {
    const c = await cat(slug)
    if (lead.length !== 20 || new Set(lead).size !== 20) { problems.push(`${slug}: the lead must be 20 distinct names`); continue }
    const rows = await shown(c)
    const byName = new Map(rows.map((r) => [r.entity.canonicalName, r]))
    const missing = lead.filter((n) => !byName.has(n))
    if (missing.length) { problems.push(`${slug}: not offered on the list: ${missing.join(', ')}`); continue }
    const leadSet = new Set(lead)
    const next = [...lead.map((n) => byName.get(n)!), ...rows.filter((r) => !leadSet.has(r.entity.canonicalName))]
    const changes = next.map((r, i) => ({ r, i })).filter(({ r, i }) => r.sortOrder !== i)
    out.push(`  ${slug} (${rows.length} values, ${changes.length} positions change)`)
    out.push(`      before: ${rows.slice(0, 20).map((r) => r.entity.canonicalName).join(' | ')}`)
    out.push(`      after:  ${next.slice(0, 20).map((r) => r.entity.canonicalName).join(' | ')}`)
    if (!apply || !changes.length) continue
    // Excluded and pending rows keep their positions; renumbering the offered ones
    // 0..n-1 can collide with them, which only matters for ties (none in these lists).
    await db.$transaction(changes.map(({ r, i }) => db.categoryEntity.update({ where: { categoryId_entityId: { categoryId: c.id, entityId: r.entityId } }, data: { sortOrder: i } })))
  }

  console.log(out.join('\n'))
  if (problems.length) console.log(`\nPROBLEMS\n  ${problems.join('\n  ')}`)
  console.log(apply ? '\nApplied.' : '\nDry run — nothing written. Re-run with --apply.')
  if (problems.length) process.exitCode = 1
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
