import { db, publishCategoryRanking } from '@project/db'
export { rankingsMinTakes } from '@project/db'

// Periodic reconciliation repairs changes outside the normal vote write path.
// It uses the same category lock and atomic publication as the fast outbox.
export async function rankingsRebuildJob() {
  const categories = await db.category.findMany({ select: { id: true } })
  let published = 0
  for (const category of categories) {
    const result = await publishCategoryRanking(category.id)
    if (result?.takeCount) published++
  }
  return { categories: categories.length, published }
}
