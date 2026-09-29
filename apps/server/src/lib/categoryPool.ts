import type { Prisma } from '@project/db'
// Curated categories have an explicit allowlist. FILTERED categories use tags but can have explicit exclusions/inclusions.
export function curatedPool(category: { id: string; poolMode: string }): Prisma.EntityWhereInput {
  if (category.poolMode === 'CURATED') {
    return { curatedForCategories: { some: { categoryId: category.id, isExcluded: false } }, mergedIntoId: null }
  }
  return { curatedForCategories: { none: { categoryId: category.id, isExcluded: true } }, mergedIntoId: null }
}

/** Category pool, plus entities this viewer submitted. A custom value is not on the allowlist, but the submitter can still find and save it. */
export function viewerCategoryPool(category: { id: string; poolMode: string }, viewerProfileId: string): Prisma.EntityWhereInput {
  return { mergedIntoId: null, OR: [curatedPool(category), { submittedByProfileId: viewerProfileId }] }
}
