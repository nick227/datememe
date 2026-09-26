import { db } from '@project/db'

// seed.ts originally created "food" and "lifestyle"; the list importers
// later created "food-drink" and "lifestyle-hobbies" for the same topics,
// so the filter bars showed Food + Food & Drink and two "Lifestyle &
// Hobbies" chips. The importer slugs are canonical (seed.ts now uses them
// too) — this folds the old groups into them. Idempotent: safe to re-run,
// and safe on a database that never had the duplicates.
const MERGES: { from: string; to: string; label: string }[] = [
  { from: 'food', to: 'food-drink', label: 'Food & Drink' },
  { from: 'lifestyle', to: 'lifestyle-hobbies', label: 'Lifestyle & Hobbies' },
]

async function run() {
  for (const { from, to, label } of MERGES) {
    const source = await db.categoryGroup.findUnique({ where: { slug: from } })
    if (!source) {
      console.log(`${from}: not present, nothing to merge`)
      continue
    }
    const target = await db.categoryGroup.findUnique({ where: { slug: to } })
    if (!target) {
      // Only the old group exists — just give it the canonical slug.
      await db.categoryGroup.update({ where: { id: source.id }, data: { slug: to, label } })
      console.log(`${from}: renamed to ${to}`)
      continue
    }
    await db.$transaction(async (tx) => {
      const moved = await tx.category.updateMany({ where: { groupId: source.id }, data: { groupId: target.id } })
      const drafts = await tx.categoryDraft.updateMany({ where: { groupId: source.id }, data: { groupId: target.id } })
      await tx.categoryGroup.delete({ where: { id: source.id } })
      console.log(`${from} -> ${to}: moved ${moved.count} categories, ${drafts.count} category drafts`)
    })
  }
}

run()
  .then(() => db.$disconnect())
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1) })
