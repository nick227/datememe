import { db } from '@project/db'

// The site-wide Rankings (GET /rankings/feed, /categories/{slug}/rankings)
// are rebuilt from scratch on a timer rather than maintained incrementally
// from every write path — seeds, importers, admin merges, and account
// deletions all bypass ListService, and a full rebuild repairs them for free.
// This job is the one canonical source for a category's ranking and for the
// Category.popularityCount / topPickEntityId every other surface shows.

const SET_KEY = { subjectType: 'ENTITY', metric: 'LIST_SCORE', scopeType: 'CATEGORY', window: 'ALL_TIME' } as const
const BASELINE_MS = 24 * 60 * 60 * 1000

// Below this many answers a "site ranking" is just one or two people's
// lists — not published at all (3 in production, 1 in dev for something to look at).
export function rankingsMinTakes() {
  const n = parseInt(process.env.RANKINGS_MIN_TAKES || '3', 10)
  return Number.isFinite(n) && n >= 1 ? n : 3
}

type Row = { categoryId: string; entityId: string; score: number; pickCount: number; firstPlaceCount: number }

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

export async function rankingsRebuildJob() {
  const minTakes = rankingsMinTakes()
  const now = new Date()

  const categories = await db.category.findMany({ select: { id: true, isActive: true, popularityCount: true, topPickEntityId: true } })
  let published = 0

  for (const category of categories) {
    let takeCount = 0
    let ranked: Row[] = []

    if (category.isActive) {
      const takeRow = await db.$queryRawUnsafe<{ takeCount: number }[]>(`
        SELECT CAST(COUNT(DISTINCT l.id) AS SIGNED) AS takeCount
        ${ELIGIBLE} AND c.id = ?
      `, category.id)
      
      takeCount = Number(takeRow[0]?.takeCount || 0)
      
      if (takeCount >= minTakes) {
        const rows = await db.$queryRawUnsafe<Row[]>(`
          SELECT l.categoryId AS categoryId, e.id AS entityId,
            CAST(SUM(CASE WHEN c.orderingMode = 'RANKED' THEN GREATEST(1, c.maxItems - li.rank + 1) ELSE 1 END) AS SIGNED) AS score,
            CAST(COUNT(DISTINCT l.profileId) AS SIGNED) AS pickCount,
            CAST(COUNT(DISTINCT CASE WHEN li.rank = 1 THEN l.profileId END) AS SIGNED) AS firstPlaceCount
          ${ELIGIBLE} AND c.id = ?
          GROUP BY l.categoryId, e.id
          ORDER BY score DESC, pickCount DESC, firstPlaceCount DESC, e.id ASC
        `, category.id)
        
        ranked = rows.map(r => ({
          ...r,
          score: Number(r.score),
          pickCount: Number(r.pickCount),
          firstPlaceCount: Number(r.firstPlaceCount)
        }))
      }
    }

    const isPublished = takeCount >= minTakes
    const topPickEntityId = isPublished ? ranked[0]?.entityId ?? null : null

    await db.$transaction(async (tx) => {
      const existing = await tx.resultSet.findUnique({
        where: { idx_result_set_unique: { ...SET_KEY, scopeValue: category.id } },
        select: { id: true, baselineAt: true, entries: { select: { subjectId: true, rank: true, previousRank: true } } },
      })

      if (!isPublished || !ranked.length) {
        if (existing) await tx.resultSet.delete({ where: { id: existing.id } })
      } else {
        published++
        // Trend arrows mean "since the last daily baseline", not "since the
        // last refresh": roll previousRank forward only once the baseline
        // is 24h old, otherwise carry the existing baseline rank through.
        const rollBaseline = !existing?.baselineAt || now.getTime() - existing.baselineAt.getTime() >= BASELINE_MS
        const before = new Map((existing?.entries ?? []).map((e) => [e.subjectId, e]))
        const previousRankFor = (entityId: string) => {
          const prior = before.get(entityId)
          if (!prior) return null
          return rollBaseline ? prior.rank : prior.previousRank
        }

        const set = await tx.resultSet.upsert({
          where: { idx_result_set_unique: { ...SET_KEY, scopeValue: category.id } },
          update: { takeCount, ...(rollBaseline ? { baselineAt: now } : {}) },
          create: { ...SET_KEY, scopeValue: category.id, takeCount, baselineAt: now },
        })
        await tx.resultEntry.deleteMany({ where: { resultSetId: set.id } })
        await tx.resultEntry.createMany({
          data: ranked.map((r, i) => ({
            resultSetId: set.id,
            subjectId: r.entityId,
            rank: i + 1,
            // A brand-new set has no baseline to compare against — no arrows yet.
            previousRank: existing ? previousRankFor(r.entityId) : i + 1,
            score: r.score,
            pickCount: r.pickCount,
            firstPlaceCount: r.firstPlaceCount,
          })),
        })
      }

      // One #1 across the app: Lists' "#1" is this ranking's #1 (or none,
      // below the publish threshold), not a separately computed statistic.
      if (category.popularityCount !== takeCount || category.topPickEntityId !== topPickEntityId) {
        await tx.category.update({ where: { id: category.id }, data: { popularityCount: takeCount, topPickEntityId } })
      }
    })
  }

  return { categories: categories.length, published, minTakes }
}
