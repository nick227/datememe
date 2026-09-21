import type { AuthenticatedRequest } from '../lib/userContext'
import { requireProfileId } from '../lib/userContext'
import { ContentFeedService } from '../services/ContentFeedService'

const contentFeedService = new ContentFeedService()

// Multi-select categories travel over the wire as one comma-separated query
// param ("groupSlugs=music,food") rather than a repeated key — sidesteps
// fastify's array-vs-scalar querystring coercion for a single selection.
function parseGroupSlugs(raw?: string): string[] | undefined {
  if (!raw) return undefined
  const slugs = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return slugs.length ? slugs : undefined
}

export async function getListsFeed(request: AuthenticatedRequest, reply: any) {
  const { groupSlugs, ...query } = request.query
  const result = await contentFeedService.getListsFeed(requireProfileId(request.user), { ...query, groupSlugs: parseGroupSlugs(groupSlugs) })
  return reply.send(result)
}

export async function getListsFeedCollection(request: AuthenticatedRequest, reply: any) {
  const result = await contentFeedService.getListsFeedCollection(
    requireProfileId(request.user),
    request.params.collectionId,
    request.query,
  )
  return reply.send(result)
}

export async function getDiscoverFeed(request: AuthenticatedRequest, reply: any) {
  const { groupSlugs, ...query } = request.query
  const result = await contentFeedService.getDiscoverFeed(request.user.id, requireProfileId(request.user), {
    ...query,
    groupSlugs: parseGroupSlugs(groupSlugs),
  })
  return reply.send(result)
}

export async function getDiscoverFeedCollection(request: AuthenticatedRequest, reply: any) {
  const result = await contentFeedService.getDiscoverFeedCollection(
    request.user.id,
    requireProfileId(request.user),
    request.params.collectionId,
    request.query,
  )
  return reply.send(result)
}
