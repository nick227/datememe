import { db } from '@project/db'
import { CATEGORY_INCLUDE, serializeListForViewer } from '../lib/serializers'
import { isPremiumUser } from '../lib/entitlements'
import { isBlockedEitherWay } from '../lib/blocks'

const LIST_INCLUDE = { category: { include: CATEGORY_INCLUDE }, items: { include: { entity: true } } } as const

export class ListService {
  async getMyLists(profileId: string) {
    const lists = await db.list.findMany({ where: { profileId }, include: LIST_INCLUDE })
    return lists.map((list) => serializeListForViewer(list, profileId))
  }

  /** Applies the List.visibility gate, the item-level status gate (docs §5.3/§4.5), and the block gate. */
  async getProfileLists(viewerUserId: string, viewerProfileId: string, targetProfileId: string) {
    const target = await db.profile.findUnique({ where: { id: targetProfileId } })
    if (!target) throw { statusCode: 404, message: 'Profile not found' }

    const isSelf = targetProfileId === viewerProfileId
    if (!isSelf && (await isBlockedEitherWay(viewerProfileId, targetProfileId))) {
      throw { statusCode: 404, message: 'Profile not found' }
    }
    const viewerIsPremium = isSelf || (await isPremiumUser(viewerUserId))

    const lists = await db.list.findMany({
      where: {
        profileId: targetProfileId,
        ...(isSelf ? {} : { visibility: viewerIsPremium ? { in: ['PUBLIC', 'PREMIUM_ONLY'] } : 'PUBLIC' }),
      },
      include: LIST_INCLUDE,
    })
    return lists.map((list) => serializeListForViewer(list, viewerProfileId))
  }

  /** Whole-list replace (docs §4.5) — the only place ListItem rows are written. */
  async upsertMyList(
    profileId: string,
    categorySlug: string,
    input: { items: { entityId: string; rank: number; note?: string | null }[]; isComplete?: boolean },
  ) {
    const category = await db.category.findUnique({ where: { slug: categorySlug } })
    if (!category) throw { statusCode: 404, message: 'Category not found' }

    if (input.items.length > category.maxItems) {
      throw { statusCode: 400, message: `This category allows at most ${category.maxItems} items` }
    }
    const ranks = input.items.map((i) => i.rank)
    if (new Set(ranks).size !== ranks.length) {
      throw { statusCode: 400, message: 'Ranks must be unique within a list' }
    }

    const entityIds = input.items.map((i) => i.entityId)
    if (entityIds.length) {
      const validCount = await db.entity.count({
        where: {
          id: { in: entityIds },
          entityTypeId: category.entityTypeId,
          OR: [
            { status: 'APPROVED' },
            { status: { in: ['PENDING', 'REJECTED'] }, submittedByProfileId: profileId },
          ],
        },
      })
      if (validCount !== new Set(entityIds).size) {
        throw { statusCode: 400, message: 'One or more entities are not valid for this category' }
      }
    }

    const isComplete = input.isComplete ?? input.items.length >= category.minItems

    const list = await db.$transaction(async (tx) => {
      const existing = await tx.list.findUnique({
        where: { profileId_categoryId: { profileId, categoryId: category.id } },
      })
      const wasComplete = existing?.isComplete ?? false

      const upserted = await tx.list.upsert({
        where: { profileId_categoryId: { profileId, categoryId: category.id } },
        update: { isComplete, completedAt: isComplete ? new Date() : null },
        create: { profileId, categoryId: category.id, isComplete, completedAt: isComplete ? new Date() : null },
      })

      const previousItems = await tx.listItem.findMany({ where: { listId: upserted.id } })
      const previousEntityIds = previousItems.map((i) => i.entityId)

      await tx.listItem.deleteMany({ where: { listId: upserted.id } })
      if (input.items.length) {
        await tx.listItem.createMany({
          data: input.items.map((item) => ({
            listId: upserted.id,
            entityId: item.entityId,
            rank: item.rank,
            note: item.note ?? null,
          })),
        })
      }

      // Maintain the denormalized Entity.usageCount / Category.popularityCount counters
      // (docs §4.5) — this transaction is the one place they're allowed to change.
      const previousSet = new Set(previousEntityIds)
      const currentSet = new Set(entityIds)
      const added = entityIds.filter((id) => !previousSet.has(id))
      const removed = previousEntityIds.filter((id) => !currentSet.has(id))
      if (added.length) {
        await tx.entity.updateMany({ where: { id: { in: added } }, data: { usageCount: { increment: 1 } } })
      }
      if (removed.length) {
        await tx.entity.updateMany({ where: { id: { in: removed } }, data: { usageCount: { decrement: 1 } } })
      }
      if (isComplete && !wasComplete) {
        await tx.category.update({ where: { id: category.id }, data: { popularityCount: { increment: 1 } } })
      } else if (!isComplete && wasComplete) {
        await tx.category.update({ where: { id: category.id }, data: { popularityCount: { decrement: 1 } } })
      }

      return tx.list.findUniqueOrThrow({ where: { id: upserted.id }, include: LIST_INCLUDE })
    })

    return serializeListForViewer(list, profileId)
  }
}
