import type { AuthenticatedRequest } from '../lib/userContext'
import { requireProfileId } from '../lib/userContext'
import { QuickPickService, QuickPickRequest } from '../services/QuickPickService';
import { QuickPickContextType } from '@project/db';
import { DiscoveryService } from '../services/DiscoveryService';

const discoveryService = new DiscoveryService();

export async function getNextQuickPick(request: AuthenticatedRequest, reply: any) {
  const viewerProfileId = requireProfileId(request.user);
  
  // Note: we removed getNextPeoplePrompt (Discover variant) as per the plan to simplify taxonomy traversal to pure entity-vs-entity game
  const prompt = await QuickPickService.getNextInfinitePrompt(viewerProfileId);
  
  if (!prompt) return reply.status(404).send({ error: 'No comparable contexts exist yet' });
  return reply.send({ data: prompt });
}

export async function submitQuickPickChoice(request: AuthenticatedRequest, reply: any) {
  const { contextType, contextId, winnerEntityId, loserEntityId } = request.body;
  const result = await QuickPickService.submitChoice(requireProfileId(request.user), contextType as QuickPickContextType, contextId, winnerEntityId, loserEntityId);
  return reply.send({ data: result });
}

export async function generateQuickPicks(request: AuthenticatedRequest, reply: any) {
  const { type, id, limit = 5 } = request.body;

  if (!type || !id) {
    return reply.status(400).send({ error: "Context type and id are required." });
  }

  const qpRequest: QuickPickRequest = {
    profileId: requireProfileId(request.user),
    context: {
      type: type as QuickPickContextType,
      id
    },
    limit: parseInt(limit, 10)
  };

  const { pairs } = await QuickPickService.generatePairs(qpRequest);
  return reply.send({ pairs });
}

export async function submitQuickPick(request: AuthenticatedRequest, reply: any) {
  const { contextType, contextId, winnerId, loserId } = request.body;

  if (!contextType || !contextId || !winnerId || !loserId) {
    return reply.status(400).send({ error: "Missing required fields." });
  }

  const signal = await QuickPickService.recordSignal(
    requireProfileId(request.user),
    contextType as QuickPickContextType,
    contextId,
    winnerId,
    loserId
  );

  return reply.send({ success: true, signal });
}
