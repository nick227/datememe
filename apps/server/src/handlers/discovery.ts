import type { AuthenticatedRequest } from '../lib/userContext'
import { requireProfileId } from '../lib/userContext'
import { DiscoveryService } from '../services/DiscoveryService'

const discoveryService = new DiscoveryService()

export async function getDiscoveryFeed(request: AuthenticatedRequest, reply: any) {
  const result = await discoveryService.getDiscoveryFeed(request.user.id, requireProfileId(request.user), request.query)
  return reply.send(result)
}
