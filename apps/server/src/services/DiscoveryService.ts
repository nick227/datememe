import { db } from '@project/db'
import { decodeCursor, encodeCursor, normalizeLimit } from '../lib/pagination'
import { PROFILE_INCLUDE, serializeProfile } from '../lib/serializers'
import { isPremiumUser } from '../lib/entitlements'

/** Below this usageCount, a shared pick is rare enough to call out by name. Tunable. */
const RARE_USAGE_COUNT_THRESHOLD = 3
/** Saturation constant for the raw rarity-weighted score → 0-100 display percentage. Tunable. */
const MATCH_PERCENTAGE_K = 3

type SharedItem = { categoryShortLabel: string; entityName: string; usageCount: number }

function toMatchPercentage(score: number) {
  return Math.round(100 * (1 - Math.exp(-score / MATCH_PERCENTAGE_K)))
}

/** Heuristic MVP copy-generation (docs §7) — not a scored ML feature, just threshold rules. */
function buildInsights(shared: SharedItem[]) {
  const insights: { icon: string; title: string; description: string }[] = []

  if (shared.length >= 5) {
    insights.push({
      icon: 'shared-taste',
      title: 'Shared taste',
      description: `You both love ${shared
        .slice(0, 2)
        .map((s) => s.entityName)
        .join(' and ')}.`,
    })
  } else if (shared.length >= 1) {
    insights.push({
      icon: 'shared-taste',
      title: 'Something in common',
      description: `You both picked ${shared[0]!.entityName} for ${shared[0]!.categoryShortLabel}.`,
    })
  }

  const rare = shared.find((s) => s.usageCount <= RARE_USAGE_COUNT_THRESHOLD)
  if (rare) {
    insights.push({
      icon: 'rare-overlap',
      title: 'Rare overlap',
      description: `You both picked ${rare.entityName} — not many people do.`,
    })
  }

  return insights
}

/**
 * MVP overlap scoring (docs §7): rarity-weighted shared favorites, computed on read
 * over the current page of candidates. Pagination is by profile recency (stable
 * cursor), not by score — score-ordered discovery needs the CompatibilityScore cache,
 * which is explicitly Phase 2 (docs §11/§14). Unlimited for every membership tier (§4.1).
 * Already-swiped and blocked profiles (either direction, either party) never reappear.
 */
export class DiscoveryService {
  async getDiscoveryFeed(viewerUserId: string, viewerProfileId: string, opts: { cursor?: string; limit?: number }) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)

    const candidates = await db.profile.findMany({
      where: {
        id: { not: viewerProfileId },
        isDiscoverable: true,
        NOT: [
          { swipesReceived: { some: { actorProfileId: viewerProfileId } } },
          { blocksMade: { some: { blockedProfileId: viewerProfileId } } },
          { blocksReceived: { some: { blockerProfileId: viewerProfileId } } },
        ],
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: PROFILE_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })

    const hasMore = candidates.length > limit
    const page = hasMore ? candidates.slice(0, limit) : candidates
    const last = page[page.length - 1]
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null

    const viewerIsPremium = await isPremiumUser(viewerUserId)

    const viewerItems = await db.listItem.findMany({
      where: { list: { profileId: viewerProfileId } },
      include: { entity: true, list: { include: { category: true } } },
    })
    const viewerByEntityId = new Map<string, { usageCount: number; entityName: string; categoryShortLabel: string }>()
    for (const item of viewerItems) {
      viewerByEntityId.set(item.entityId, {
        usageCount: item.entity.usageCount,
        entityName: item.entity.canonicalName,
        categoryShortLabel: item.list.category.shortLabel,
      })
    }

    const candidateIds = page.map((p) => p.id)
    const candidateItems = candidateIds.length
      ? await db.listItem.findMany({
          where: { list: { profileId: { in: candidateIds } } },
          include: { list: true },
        })
      : []

    const itemsByProfileId = new Map<string, typeof candidateItems>()
    for (const item of candidateItems) {
      const pid = item.list.profileId
      const bucket = itemsByProfileId.get(pid)
      if (bucket) bucket.push(item)
      else itemsByProfileId.set(pid, [item])
    }

    const data = page.map((profile) => {
      const items = itemsByProfileId.get(profile.id) ?? []
      const shared: SharedItem[] = []
      const sharedFavorites: { categoryShortLabel: string; entityName: string }[] = []
      let score = 0
      for (const item of items) {
        const match = viewerByEntityId.get(item.entityId)
        if (match) {
          score += 1 / Math.log(match.usageCount + 2)
          shared.push(match)
          sharedFavorites.push({ categoryShortLabel: match.categoryShortLabel, entityName: match.entityName })
        }
      }
      return {
        profile: serializeProfile(profile, { revealPhoto: viewerIsPremium }),
        sharedItemsCount: shared.length,
        sharedFavorites,
        matchPercentage: toMatchPercentage(score),
        insights: buildInsights(shared),
      }
    })

    return { data, meta: { hasMore, nextCursor } }
  }
}
