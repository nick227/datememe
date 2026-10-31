import { curatedPool } from '../lib/categoryPool'
import { db, Prisma } from '@project/db'
import { LIST_PREVIEW_SELECT, serializeListForViewer } from '../lib/serializers'
import { resolveEntitlements } from '../lib/entitlements'
import { isBlockedEitherWay } from '../lib/blocks'
import { MessagingService } from './MessagingService'

const messagingService = new MessagingService()

export class ListService {
  async getMyLists(profileId: string, client: Prisma.TransactionClient = db) {
    const lists = await client.list.findMany({ where: { profileId }, select: LIST_PREVIEW_SELECT })
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
    const canReadMemberLists = isSelf || ((await resolveEntitlements(viewerUserId))['lists.memberOnly'])

    const lists = await db.list.findMany({
      where: {
        profileId: targetProfileId,
        ...(isSelf ? {} : { visibility: canReadMemberLists ? { in: ['PUBLIC', 'PREMIUM_ONLY'] } : 'PUBLIC' }),
      },
      select: LIST_PREVIEW_SELECT,
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
          ...curatedPool(category),
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

    const isComplete = input.isComplete !== false && input.items.length >= category.minItems

    const { list, answerRevision } = await db.$transaction(async (tx) => {
      // Same lock order as snapshot publication: Category, then list/outbox.
      await tx.$queryRaw`SELECT id FROM Category WHERE id = ${category.id} FOR UPDATE`
      const updated = await tx.category.update({
        where: { id: category.id }, data: { answerRevision: { increment: 1 } },
        select: { answerRevision: true },
      })
      const now = new Date()
      await tx.categoryRankingRefresh.upsert({
        where: { categoryId: category.id },
        create: { categoryId: category.id, requestedAt: now, availableAt: now },
        update: { requestedAt: now, availableAt: now, attempts: 0, lastError: null },
      })
      const existing = await tx.list.findUnique({
        where: { profileId_categoryId: { profileId, categoryId: category.id } },
      })
      const wasComplete = existing?.isComplete ?? false

      const upserted = await tx.list.upsert({
        where: { profileId_categoryId: { profileId, categoryId: category.id } },
        update: { isComplete, completedAt: isComplete ? new Date() : null },
        create: { profileId, categoryId: category.id, isComplete, completedAt: isComplete ? new Date() : null },
      })

      const previousItems = await tx.listItem.findMany({
        where: { listId: upserted.id },
        select: { entityId: true },
      })
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

      // Delegate heavy counter updates and matching to the background worker MVP
      const previousSet = new Set(previousEntityIds)
      const currentSet = new Set(entityIds)
      const added = entityIds.filter((id) => !previousSet.has(id))
      const removed = previousEntityIds.filter((id) => !currentSet.has(id))

      let isCompleteDiff: 1 | -1 | 0 = 0
      if (isComplete && !wasComplete) isCompleteDiff = 1
      else if (!isComplete && wasComplete) isCompleteDiff = -1

      const jobsToCreate: any[] = [
        {
          type: 'UPDATE_TAXONOMY',
          payload: { addedEntities: added, removedEntities: removed, categoryId: category.id, isCompleteDiff, currentEntityIds: entityIds },
        },
        {
          type: 'CALCULATE_MATCHES',
          payload: { profileId },
        },
      ]

      await tx.jobQueue.createMany({ data: jobsToCreate })

      return { list: await tx.list.findUniqueOrThrow({ where: { id: upserted.id }, select: LIST_PREVIEW_SELECT }), answerRevision: updated.answerRevision }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })

    // Idempotent eventKey means every complete save can safely repair activity
    // history after a partial failure without producing duplicate entries.
    if (isComplete) {
      await messagingService.recordSystemActivity(profileId, {
        type: 'LIST_COMPLETED',
        eventKey: `list-completed:${profileId}:${category.id}`,
        title: category.shortLabel,
        categoryId: category.id,
        categorySlug: category.slug,
        listId: list.id,
        notify: false,
      })
    }

    return { ...serializeListForViewer(list, profileId), answerRevision }
  }
}
