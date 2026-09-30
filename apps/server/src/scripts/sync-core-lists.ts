import { readFileSync } from 'fs'
import { resolve } from 'path'
import { db } from '@project/db'
import { key, legacyAsciiKey } from '../lib/identityKey'
import { CORE_GROUP_SLUG } from '../lib/coreLists'

// Writes catalog/core-lists.json to the `core` SitePickGroup: pinned first on
// Lists (sortOrder -1), items in file order. The file is the source of truth —
// re-running replaces the group's items. DB-only; dry run unless --apply:
//
//   DATABASE_URL=<target> pnpm --filter server exec tsx src/scripts/sync-core-lists.ts [--apply]
const apply = process.argv.includes('--apply')
const FILE = resolve(__dirname, '../../../../catalog/core-lists.json')

async function main() {
  const { label, lists } = JSON.parse(readFileSync(FILE, 'utf8')) as { label: string; lists: string[] }
  const categories: { id: string; shortLabel: string; isActive: boolean }[] = []
  for (const title of lists) {
    const c = await db.category.findFirst({
      where: { OR: [{ slug: { in: [...new Set([key(title), legacyAsciiKey(title)])] } }, { shortLabel: title }] },
      select: { id: true, shortLabel: true, isActive: true },
    })
    if (!c) throw new Error(`No list titled "${title}"`)
    if (!c.isActive) throw new Error(`"${title}" is hidden; a core list must be live`)
    categories.push(c)
  }
  const existing = await db.sitePickGroup.findUnique({ where: { slug: CORE_GROUP_SLUG }, include: { items: { orderBy: { sortOrder: 'asc' } } } })
  const same = existing?.label === label && existing.sortOrder === -1 && existing.isActive
    && existing.items.map((i) => i.categoryId).join() === categories.map((c) => c.id).join()
  console.log(`${same ? 'unchanged' : apply ? 'writing' : 'would write'} "${label}": ${categories.map((c) => c.shortLabel).join(' · ')}`)
  if (!apply || same) return

  await db.$transaction(async (tx) => {
    const group = await tx.sitePickGroup.upsert({
      where: { slug: CORE_GROUP_SLUG },
      create: { slug: CORE_GROUP_SLUG, label, sortOrder: -1, isActive: true },
      update: { label, sortOrder: -1, isActive: true },
    })
    await tx.sitePickItem.deleteMany({ where: { groupId: group.id } })
    await tx.sitePickItem.createMany({ data: categories.map((c, sortOrder) => ({ groupId: group.id, categoryId: c.id, sortOrder })) })
  })
  console.log(`CORE_LISTS ${JSON.stringify({ applied: true, lists: categories.length })}`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => db.$disconnect())
