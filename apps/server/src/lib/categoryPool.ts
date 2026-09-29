import type { Prisma } from '@project/db'
// Curated categories have an explicit allowlist. FILTERED categories use tags but can have explicit exclusions/inclusions.
export function curatedPool(category: { id: string; poolMode: string }): Prisma.EntityWhereInput {
  if (category.poolMode === 'CURATED') {
    return { curatedForCategories: { some: { categoryId: category.id, isExcluded: false } }, mergedIntoId: null }
  }
  return { curatedForCategories: { none: { categoryId: category.id, isExcluded: true } }, mergedIntoId: null }
}
