import { db } from '@project/db'
import { decodeCursor, encodeCursor, normalizeLimit } from '../lib/pagination'
import { PROFILE_FULL_SELECT, serializeProfile } from '../lib/serializers'
import { isPremiumUser } from '../lib/entitlements'

export class DiscoveryService {
  async getDiscoveryFeed(viewerUserId: string, viewerProfileId: string, opts: { cursor?: string; limit?: number }) {
    const limit = normalizeLimit(opts.limit)
    // Decode cursor (ignoring actual cursor logic for MVP score-based pagination)
    
    // 1. Fetch pre-computed compatibility scores
    const scores = await db.compatibilityScore.findMany({
      where: {
        OR: [
          { profileIdA: viewerProfileId },
          { profileIdB: viewerProfileId }
        ]
      },
      select: {
        profileIdA: true,
        profileIdB: true,
        score: true,
        sharedItemsCount: true,
        sharedFavorites: true,
        insights: true,
      },
      orderBy: { score: 'desc' },
      take: limit + 1,
    })

    const hasMore = scores.length > limit
    const pageScores = hasMore ? scores.slice(0, limit) : scores

    if (pageScores.length === 0) {
      return { data: [], meta: { hasMore: false, nextCursor: null } }
    }

    const candidateIds = pageScores.map(s => s.profileIdA === viewerProfileId ? s.profileIdB : s.profileIdA)

    // 2. Fetch profiles, filtering out blocks/swipes
    const candidates = await db.profile.findMany({
      where: {
        id: { in: candidateIds },
        isDiscoverable: true,
        NOT: [
          { swipesReceived: { some: { actorProfileId: viewerProfileId } } },
          { blocksMade: { some: { blockedProfileId: viewerProfileId } } },
          { blocksReceived: { some: { blockerProfileId: viewerProfileId } } },
        ],
      },
      select: PROFILE_FULL_SELECT,
    })

    const candidatesById = new Map(candidates.map((c: any) => [c.id, c]))
    const viewerIsPremium = await isPremiumUser(viewerUserId)

    // 3. Assemble the response payload functionally
    const data = pageScores.flatMap(s => {
      const candidateId = s.profileIdA === viewerProfileId ? s.profileIdB : s.profileIdA
      const profile = candidatesById.get(candidateId)
      
      // If the candidate is blocked or has already been swiped, skip them
      if (!profile) return []

      return [{
        profile: serializeProfile(profile, { revealPhoto: viewerIsPremium }),
        sharedItemsCount: s.sharedItemsCount,
        sharedFavorites: s.sharedFavorites,
        matchPercentage: s.score,
        insights: s.insights,
      }]
    })

    // MVP simplified cursor (needs full cursor logic in prod)
    const nextCursor = hasMore ? encodeCursor({ score: pageScores[pageScores.length - 1].score }) : null

    return { data, meta: { hasMore, nextCursor } }
  }
}
