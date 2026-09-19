import { db } from '@project/db'
import { canonicalizePair } from '../lib/pair'

const RARE_USAGE_COUNT_THRESHOLD = 3
const MATCH_PERCENTAGE_K = 3

type SharedItem = { categoryShortLabel: string; entityName: string; usageCount: number }

function toMatchPercentage(score: number) {
  return Math.round(100 * (1 - Math.exp(-score / MATCH_PERCENTAGE_K)))
}

function buildInsights(shared: SharedItem[]) {
  const insights: { icon: string; title: string; description: string }[] = []

  if (shared.length >= 5) {
    insights.push({
      icon: 'shared-taste',
      title: 'Shared taste',
      description: `You both love ${shared.slice(0, 2).map((s) => s.entityName).join(' and ')}.`,
    })
  } else if (shared.length >= 1) {
    insights.push({
      icon: 'shared-taste',
      title: 'Something in common',
      description: `You both picked ${shared[0]!.entityName} for ${shared[0]!.categoryShortLabel}.`,
    })
  }

  const rare = shared.find((s) => s.usageCount <= RARE_USAGE_COUNT_THRESHOLD)
  if (rare) {
    insights.push({
      icon: 'rare-overlap',
      title: 'Rare overlap',
      description: `You both picked ${rare.entityName} — not many people do.`,
    })
  }

  return insights
}

export async function calculateMatchesJob(payload: { profileId: string }) {
  const { profileId } = payload

  // 1. Get viewer items, plucking only required fields
  const viewerItems = await db.listItem.findMany({
    where: { list: { profileId } },
    select: {
      entityId: true,
      entity: { select: { usageCount: true, canonicalName: true } },
      list: { select: { category: { select: { shortLabel: true } } } }
    },
  })
  
  if (viewerItems.length === 0) return // Nothing to match against

  const viewerByEntityId = new Map<string, SharedItem>()
  for (const item of viewerItems) {
    viewerByEntityId.set(item.entityId, {
      usageCount: item.entity.usageCount,
      entityName: item.entity.canonicalName,
      categoryShortLabel: item.list.category.shortLabel,
    })
  }

  const viewerEntityIds = Array.from(viewerByEntityId.keys())

  // 2. Get active candidates.
  // [MVP CAP] We limit to 1000 recently active users for the MVP. CompatibilityScore is 
  // only materialized for this active subset, not globally for all pairs in the database.
  const candidates = await db.profile.findMany({
    where: {
      id: { not: profileId },
      isDiscoverable: true,
    },
    take: 1000, 
    select: { id: true }
  })
  const candidateIds = candidates.map(c => c.id)

  if (candidateIds.length === 0) return

  // 3. Get intersecting candidate items (Logical Reduction)
  // Instead of fetching all items for all candidates, we only fetch items overlapping 
  // with the viewer's entity IDs.
  const candidateItems = await db.listItem.findMany({
    where: { 
      list: { profileId: { in: candidateIds } },
      entityId: { in: viewerEntityIds }
    },
    select: { entityId: true, list: { select: { profileId: true } } },
  })

  // Group overlapping items by candidate
  const itemsByProfileId = new Map<string, typeof candidateItems>()
  for (const item of candidateItems) {
    const pid = item.list.profileId
    const bucket = itemsByProfileId.get(pid)
    if (bucket) bucket.push(item)
    else itemsByProfileId.set(pid, [item])
  }

  // 4. Calculate scores and batch upserts
  const upsertPromises = []
  
  for (const candidateId of candidateIds) {
    const items = itemsByProfileId.get(candidateId) ?? []
    const shared: SharedItem[] = []
    const sharedFavorites: { categoryShortLabel: string; entityName: string }[] = []
    let score = 0
    
    for (const item of items) {
      const match = viewerByEntityId.get(item.entityId)
      if (match) {
        score += 1 / Math.log(match.usageCount + 2)
        shared.push(match)
        sharedFavorites.push({ categoryShortLabel: match.categoryShortLabel, entityName: match.entityName })
      }
    }
    
    const percentage = toMatchPercentage(score)
    const insights = buildInsights(shared)
    
    // Sort so profileIdA is always the lexicographically smaller ID to avoid duplicates
    const [profileIdA, profileIdB] = canonicalizePair(profileId, candidateId)

    upsertPromises.push(db.compatibilityScore.upsert({
      where: {
        profileIdA_profileIdB: {
          profileIdA,
          profileIdB
        }
      },
      update: {
        score: percentage,
        sharedItemsCount: shared.length,
        sharedFavorites,
        insights
      },
      create: {
        profileIdA,
        profileIdB,
        score: percentage,
        sharedItemsCount: shared.length,
        sharedFavorites,
        insights
      }
    }))
  }

  // Transactional Bulk Upsert
  // Chunk promises to avoid exceeding max parameterized query bounds if needed.
  // For 1000 candidates, 1000 upserts in one transaction is usually fine on MySQL, 
  // but if we hit bounds we'd chunk them. We will run it directly here.
  await db.$transaction(upsertPromises)
}

