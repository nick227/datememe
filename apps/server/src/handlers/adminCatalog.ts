import { CatalogService } from '../services/CatalogService'
import type { AuthenticatedRequest } from '../lib/userContext'
const service = new CatalogService()
export async function getAdminCatalog(request: AuthenticatedRequest, reply: any) {
  const q = request.query as any
  return reply.send(await service.state(q.conceptId, q.draftId, Number(q.offset || 0)))
}
export async function commandAdminCatalog(request: AuthenticatedRequest, reply: any) {
  return reply.send({ result: await service.command(request.user.id, request.body) })
}
