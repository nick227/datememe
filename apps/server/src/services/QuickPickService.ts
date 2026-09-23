import { curatedPool } from '../lib/categoryPool'
import { db } from '@project/db';
import { QuickPickContextType, Entity } from '@project/db';
import { ENTITY_SELECT, serializeEntity } from '../lib/serializers';

export interface QuickPickRequest {
  profileId: string;
  context: {
    type: QuickPickContextType;
    id: string; 
  };
  limit: number;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

export class QuickPickService {
  /**
   * Evaluates canonical pair identity (min, max) to ensure A vs B is the same as B vs A
   */
  static getCanonicalPair(a: string, b: string) {
    return a < b ? { entity1Id: a, entity2Id: b } : { entity1Id: b, entity2Id: a };
  }

  /**
   * Generates valid pairs of entities for Quick Picks.
   * Includes Fallback Traversal (Narrow -> Sideways -> Broad).
   */
  static async generatePairs(request: QuickPickRequest) {
    const { profileId, context, limit } = request;

    let pairs: any[] = [];
    const seenPairKeys = new Set<string>();

    // Step 1: Define the Traversal Path
    const contextsToTry = [context];

    if (context.type === 'PARENT_ENTITY') {
      const parent = await db.entity.findUnique({ where: { id: context.id } });
      if (parent) {
        // Sideways: other entities under the same parent's parent (siblings)
        if (parent.parentId) {
          const siblings = await db.entity.findMany({ 
            where: { parentId: parent.parentId, id: { not: parent.id } },
            take: 5 
          });
          for (const sib of siblings) {
            contextsToTry.push({ type: 'PARENT_ENTITY', id: sib.id });
          }
        }
        // Broad: up to the entity type
        contextsToTry.push({ type: 'ENTITY_TYPE', id: parent.entityTypeId });
      }
    }

    // Step 2: Traverse and gather pairs
    for (const ctx of contextsToTry) {
      if (pairs.length >= limit) break;

      const baseWhere: any = {
        status: 'APPROVED',
        mergedIntoId: null,
      };

      if (ctx.type === 'ENTITY_TYPE') baseWhere.entityTypeId = ctx.id;
      else if (ctx.type === 'PARENT_ENTITY') baseWhere.parentId = ctx.id;
      else if (ctx.type === 'CATEGORY') {
        const category = await db.category.findUnique({ where: { id: ctx.id } });
        if (!category) continue;
        baseWhere.entityTypeId = category.entityTypeId;
        Object.assign(baseWhere, curatedPool(category));
      }
      else if (ctx.type === 'TAG') {
        baseWhere.tags = { some: { tagId: ctx.id } };
      }

      // Fetch pool of eligible entities
      const eligibleEntities = await db.entity.findMany({
        where: baseWhere,
        take: 50, // sample pool
        select: ENTITY_SELECT,
      });

      if (eligibleEntities.length < 2) continue;

      // Fetch user's previous signals IN THIS CONTEXT to avoid repeating recently
      const previousSignals = await db.quickPickSignal.findMany({
        where: {
          profileId,
          contextType: ctx.type,
          contextId: ctx.id,
        },
        select: {
          entity1Id: true,
          entity2Id: true,
        }
      });

      const pastPairKeys = new Set(
        previousSignals.map(s => `${s.entity1Id}-${s.entity2Id}`)
      );

      // Simple naive pairing algorithm (shuffled to avoid deterministic repeats)
      const shuffledEntities = shuffle(eligibleEntities);
      
      for (let i = 0; i < shuffledEntities.length; i++) {
        for (let j = i + 1; j < shuffledEntities.length; j++) {
          if (pairs.length >= limit) break;

          const a = shuffledEntities[i];
          const b = shuffledEntities[j];
          if (!a || !b) continue;

          // Ensure they are strictly comparable peers (same entity type)
          if (a.entityTypeId !== b.entityTypeId) continue;

          const canonical = this.getCanonicalPair(a.id, b.id);
          const pairKey = `${canonical.entity1Id}-${canonical.entity2Id}`;

          if (!pastPairKeys.has(pairKey) && !seenPairKeys.has(pairKey)) {
            pairs.push({
              entityA: a,
              entityB: b,
              contextParams: ctx
            });
            seenPairKeys.add(pairKey);
          }
        }
        if (pairs.length >= limit) break;
      }
    }

    return { pairs };
  }

  static async getNextInfinitePrompt(profileId: string) {
    // Randomly pick a Category to serve as the context
    const categories = await db.category.findMany({
      where: { isActive: true },
    });
    if (!categories.length) return null;

    const shuffledCategories = shuffle(categories);

    for (const category of shuffledCategories) {
      const { pairs } = await this.generatePairs({
        profileId,
        context: { type: 'CATEGORY', id: category.id },
        limit: 1
      });

      if (pairs.length > 0) {
        const pair = pairs[0];
        return {
          contextType: pair.contextParams.type,
          contextId: pair.contextParams.id,
          contextLabel: category.shortLabel || category.prompt,
          prompt: category.prompt || 'Which is better?',
          optionA: serializeEntity(pair.entityA),
          optionB: serializeEntity(pair.entityB),
        };
      }
    }

    // If all categories are exhausted, try pulling random EntityTypes
    const entityTypes = await db.entityType.findMany();
    const shuffledEntityTypes = shuffle(entityTypes);

    for (const et of shuffledEntityTypes) {
      const { pairs } = await this.generatePairs({
        profileId,
        context: { type: 'ENTITY_TYPE', id: et.id },
        limit: 1
      });

      if (pairs.length > 0) {
        const pair = pairs[0];
        return {
          contextType: pair.contextParams.type,
          contextId: pair.contextParams.id,
          contextLabel: et.pluralLabel,
          prompt: `Which is the better ${et.label.toLowerCase()}?`,
          optionA: serializeEntity(pair.entityA),
          optionB: serializeEntity(pair.entityB),
        };
      }
    }

    return null;
  }

  static async submitChoice(profileId: string, contextType: QuickPickContextType, contextId: string, winnerEntityId: string, loserEntityId: string) {
    if (contextType === 'CATEGORY') {
      const category = await db.category.findUnique({ where: { id: contextId } });
      if (!category) throw { statusCode: 404, message: 'Category not found' };
      if (category.poolMode === 'CURATED') {
        const count = await db.entity.count({ where: { id: { in: [winnerEntityId, loserEntityId] }, entityTypeId: category.entityTypeId, status: 'APPROVED', ...curatedPool(category) } });
        if (count !== 2) throw { statusCode: 400, message: 'Values are not in this curated list' };
      }
    }
    if (winnerEntityId === loserEntityId) throw { statusCode: 400, message: 'Winner and loser must differ' };
    const { entity1Id, entity2Id } = this.getCanonicalPair(winnerEntityId, loserEntityId);

    const existing = await db.quickPickSignal.findFirst({
      where: { profileId, contextType, contextId, entity1Id, entity2Id },
      select: { id: true },
    });

    if (!existing) {
      await db.quickPickSignal.create({
        data: { profileId, contextType, contextId, entity1Id, entity2Id, winnerId: winnerEntityId, loserId: loserEntityId },
      });
    }

    const pairSignals = await db.quickPickSignal.findMany({
      where: { contextType, contextId, entity1Id, entity2Id },
      select: { winnerId: true },
    });

    const totalComparisons = pairSignals.length;
    const winnerCount = pairSignals.filter(s => s.winnerId === winnerEntityId).length;
    const winnerPercent = totalComparisons ? Math.round((winnerCount / totalComparisons) * 100) : 100;
    const loserPercent = 100 - winnerPercent;

    const [winnerOverallWinRate, loserOverallWinRate] = await Promise.all([
      this.getOverallWinRate(contextType, contextId, winnerEntityId),
      this.getOverallWinRate(contextType, contextId, loserEntityId),
    ]);

    return {
      contextType,
      contextId,
      winnerEntityId,
      loserEntityId,
      winnerPercent,
      loserPercent,
      totalComparisons,
      winnerOverallWinRate,
      loserOverallWinRate,
    };
  }

  private static async getOverallWinRate(contextType: QuickPickContextType, contextId: string, entityId: string): Promise<number | null> {
    const [wins, losses] = await Promise.all([
      db.quickPickSignal.count({ where: { contextType, contextId, winnerId: entityId } }),
      db.quickPickSignal.count({ where: { contextType, contextId, loserId: entityId } }),
    ]);
    const total = wins + losses;
    return total ? Math.round((wins / total) * 100) : null;
  }

  /**
   * Helper to submit a Quick Pick Answer
   */
  static async recordSignal(profileId: string, contextType: QuickPickContextType, contextId: string, winnerId: string, loserId: string) {
    if (contextType === 'CATEGORY') {
      const category = await db.category.findUnique({ where: { id: contextId } });
      if (!category) throw { statusCode: 404, message: 'Category not found' };
      if (category.poolMode === 'CURATED' && await db.entity.count({ where: { id: { in: [winnerId, loserId] }, entityTypeId: category.entityTypeId, status: 'APPROVED', ...curatedPool(category) } }) !== 2) throw { statusCode: 400, message: 'Values are not in this curated list' };
    }
    const canonical = this.getCanonicalPair(winnerId, loserId);
    
    return await db.quickPickSignal.create({
      data: {
        profileId,
        contextType,
        contextId,
        entity1Id: canonical.entity1Id,
        entity2Id: canonical.entity2Id,
        winnerId,
        loserId
      }
    });
  }
}
