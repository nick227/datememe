import type { AuthenticatedRequest } from '../lib/userContext'
import { requireProfileId } from '../lib/userContext'
import { RankingsService } from '../services/RankingsService'

const rankingsService = new RankingsService()

// Same comma-joined multi-select as GET /lists/feed and /discover/feed.
export async function getRankingsFeed(request: AuthenticatedRequest, reply: any) {
  const raw: string | undefined = request.query.groupSlugs
  const groupSlugs = raw?.split(',').map((s: string) => s.trim()).filter(Boolean)
  const result = await rankingsService.getRankingsFeed(requireProfileId(request.user), { groupSlugs })
  return reply.send(result)
}

export async function getCategoryRankings(request: AuthenticatedRequest, reply: any) {
  const data = await rankingsService.getCategoryRankings(requireProfileId(request.user), request.params.categorySlug)
  return reply.send({ data })
}
