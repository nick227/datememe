import { db } from './client'
import { Prisma } from '@prisma/client'

// Participation threshold for featuring a category. Result visibility itself
// starts with the first eligible answer, independently of this setting.
export function rankingsMinTakes() {
  const n = parseInt(process.env.RANKINGS_MIN_TAKES || '3', 10)
  return Number.isFinite(n) && n >= 1 ? n : 3
}

export type RankingRow = { categoryId: string; entityId: string; score: number; pickCount: number; firstPlaceCount: number }

// Shared WHERE for both aggregates: a completed list, by a live account, in
// an active category, of an approved entity (merged duplicates count toward
// the entity they were merged into).
const ELIGIBLE = `
  FROM ListItem li
  JOIN List l      ON l.id = li.listId
  JOIN Category c  ON c.id = l.categoryId
  JOIN Profile p   ON p.id = l.profileId
  JOIN User u      ON u.id = p.userId
  JOIN Entity src  ON src.id = li.entityId
  JOIN Entity e    ON e.id = COALESCE(src.mergedIntoId, src.id)
  WHERE l.isComplete = 1
    AND c.isActive = 1
    AND u.suspendedAt IS NULL
    AND u.deletedAt IS NULL
    AND e.status = 'APPROVED'
`

// Shared scoring for category publication and periodic reconciliation.
export async function readCategoryRanking(categoryId: string, client: Prisma.TransactionClient = db) {
  const takeRows = await client.$queryRawUnsafe<{ takeCount: number }[]>(`
    SELECT CAST(COUNT(DISTINCT l.id) AS SIGNED) AS takeCount
    ${ELIGIBLE} AND c.id = ?
  `, categoryId)
  const takeCount = Number(takeRows[0]?.takeCount || 0)
  if (takeCount === 0) return { takeCount, ranked: [] as RankingRow[] }

  const rows = await client.$queryRawUnsafe<RankingRow[]>(`
    SELECT l.categoryId AS categoryId, e.id AS entityId,
      CAST(SUM(CASE WHEN c.orderingMode = 'RANKED' THEN GREATEST(1, c.maxItems - li.rank + 1) ELSE 1 END) AS SIGNED) AS score,
      CAST(COUNT(DISTINCT l.profileId) AS SIGNED) AS pickCount,
      CAST(COUNT(DISTINCT CASE WHEN li.rank = 1 THEN l.profileId END) AS SIGNED) AS firstPlaceCount
    ${ELIGIBLE} AND c.id = ?
    GROUP BY l.categoryId, e.id
    ORDER BY score DESC, pickCount DESC, firstPlaceCount DESC, e.id ASC
  `, categoryId)
  return {
    takeCount,
    ranked: rows.map(r => ({ ...r, score: Number(r.score), pickCount: Number(r.pickCount), firstPlaceCount: Number(r.firstPlaceCount) })),
  }
}

export const LIST_SCORE_SET = { subjectType: 'ENTITY', metric: 'LIST_SCORE', scopeType: 'CATEGORY', window: 'ALL_TIME' } as const
const BASELINE_MS = 24 * 60 * 60 * 1000

/** Serialize publication with votes and other publishers. The Category lock is
 * acquired before ranking reads; the snapshot is checked against the locked
 * revision so all counts describe the same committed database snapshot. A queued job never carries
 * precomputed results that could overwrite a newer publication. */
export async function publishCategoryRanking(categoryId: string, pendingOnly = false): Promise<{ categoryId: string; revision: number; takeCount: number } | null> {
  for (let attempt = 0; ; attempt++) {
    try { return await publishCategorySnapshot(categoryId, pendingOnly) }
    catch (error) {
      if (attempt >= 3 || !(error instanceof Error) ||
        (error.message !== 'Ranking snapshot changed while acquiring lock' &&
          !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'))) throw error
    }
  }
}

async function publishCategorySnapshot(categoryId: string, pendingOnly: boolean) {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string; answerRevision: number; rankingRevision: number }[]>`SELECT id, answerRevision, rankingRevision FROM Category WHERE id = ${categoryId} FOR UPDATE`
    if (!locked.length) return null
    // MariaDB may establish the repeatable-read snapshot before a contended
    // locking read completes. Validate it against the current locked version;
    // otherwise an old snapshot could consume a newer outbox request.
    const category = await tx.category.findUniqueOrThrow({ where: { id: categoryId } })
    if (category.answerRevision !== locked[0]!.answerRevision || category.rankingRevision !== locked[0]!.rankingRevision) {
      throw new Error('Ranking snapshot changed while acquiring lock')
    }
    if (pendingOnly) {
      const pending = await tx.categoryRankingRefresh.findUnique({ where: { categoryId } })
      if (!pending || pending.availableAt > new Date()) return null
    }
    const { takeCount, ranked } = await readCategoryRanking(categoryId, tx)
    const key = { ...LIST_SCORE_SET, scopeValue: categoryId }
    const existing = await tx.resultSet.findUnique({
      where: { idx_result_set_unique: key },
      include: { entries: { select: { subjectId: true, rank: true, previousRank: true } } },
    })
    const now = new Date()
    const rollBaseline = !existing?.baselineAt || now.getTime() - existing.baselineAt.getTime() >= BASELINE_MS
    const before = new Map(existing?.entries.map(e => [e.subjectId, e]) ?? [])
    // Retain an empty snapshot too: removing the last eligible answer still
    // publishes a revision that clients can acknowledge.
    const set = await tx.resultSet.upsert({
      where: { idx_result_set_unique: key },
      create: { ...key, takeCount, sourceRevision: category.answerRevision, baselineAt: now },
      update: { takeCount, sourceRevision: category.answerRevision, ...(rollBaseline ? { baselineAt: now } : {}) },
    })
    await tx.resultEntry.deleteMany({ where: { resultSetId: set.id } })
    if (ranked.length) await tx.resultEntry.createMany({ data: ranked.map((row, i) => {
      const prior = before.get(row.entityId)
      return {
        resultSetId: set.id, subjectId: row.entityId, rank: i + 1,
        previousRank: !existing ? i + 1 : prior ? (rollBaseline ? prior.rank : prior.previousRank) : null,
        score: row.score, pickCount: row.pickCount, firstPlaceCount: row.firstPlaceCount,
      }
    }) })
    await tx.category.update({ where: { id: categoryId }, data: {
      rankingRevision: category.answerRevision,
      popularityCount: takeCount,
      topPickEntityId: ranked[0]?.entityId ?? null,
    } })
    await tx.categoryRankingRefresh.deleteMany({ where: { categoryId } })
    return { categoryId, revision: category.answerRevision, takeCount }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 })
}

/** The row remains durable after failures, and later votes wake it immediately. */
export async function refreshPendingCategoryRankings(limit = 20) {
  const pending = await db.categoryRankingRefresh.findMany({
    where: { availableAt: { lte: new Date() } }, orderBy: { availableAt: 'asc' }, take: limit,
  })
  for (const item of pending) {
    try {
      const result = await publishCategoryRanking(item.categoryId, true)
      if (result) console.log(JSON.stringify({ event: 'CATEGORY_RANKING_PUBLISHED', ...result, lagMs: Date.now() - item.requestedAt.getTime() }))
    } catch (error) {
      // Compare requestedAt so a failed old attempt cannot delay a newer vote.
      await db.categoryRankingRefresh.updateMany({
        where: { categoryId: item.categoryId, requestedAt: item.requestedAt },
        data: { attempts: { increment: 1 }, lastError: error instanceof Error ? error.message : String(error),
          availableAt: new Date(Date.now() + Math.min(30000, 1000 * 2 ** Math.min(item.attempts, 5))) },
      })
      console.error('Category ranking refresh failed', item.categoryId, error)
    }
  }
  return pending.length
}
