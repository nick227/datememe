import type { Prisma } from '@project/db'
// Every list offers exactly its CategoryEntity rows. Lists that offered every value of
// their type ("FILTERED") were snapshotted into rows on 2026-09-29 (scripts/curate-all-lists.ts).
export function curatedPool(category: { id: string }): Prisma.EntityWhereInput {
  return { curatedForCategories: { some: { categoryId: category.id, isExcluded: false } }, mergedIntoId: null }
}
