import { DiscoveryService } from '../services/DiscoveryService'

const discoveryService = new DiscoveryService()

export async function getDiscoveryFeed(request: any, reply: any) {
  const result = await discoveryService.getDiscoveryFeed(request.user.id, request.user.profile.id, request.query)
  return reply.send(result)
}
