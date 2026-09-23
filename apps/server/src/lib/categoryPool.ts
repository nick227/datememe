import type { Prisma } from '@project/db'
// Curated categories have an explicit allowlist. Legacy FILTERED behavior is preserved.
export function curatedPool(category: { id: string; poolMode: string }): Prisma.EntityWhereInput {
  return category.poolMode === 'CURATED' ? { curatedForCategories: { some: { categoryId: category.id } }, mergedIntoId: null } : {}
}
