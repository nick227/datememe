import type { AuthenticatedRequest } from '../lib/userContext'
import { requireProfileId } from '../lib/userContext'
import { ContentFeedService } from '../services/ContentFeedService'

const contentFeedService = new ContentFeedService()

export async function getListsFeed(request: AuthenticatedRequest, reply: any) {
  const result = await contentFeedService.getListsFeed(requireProfileId(request.user), request.query)
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
  const result = await contentFeedService.getDiscoverFeed(request.user.id, requireProfileId(request.user), request.query)
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
