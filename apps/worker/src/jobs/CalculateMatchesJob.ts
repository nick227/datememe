import { db } from '@project/db'
import { canonicalizePair } from '../lib/pair'
import { SCORING_CONFIG } from '../config/scoring'

function computeCosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>) {
  let dot = 0
  let normA = 0
  let normB = 0
  for (const [k, v] of vecA.entries()) {
    dot += v * (vecB.get(k) ?? 0)
    normA += v * v
  }
  for (const v of vecB.values()) {
    normB += v * v
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export async function calculateMatchesJob(payload: { profileId: string }) {
  const { profileId } = payload

  // 1. Fetch categories and axes IDF
  const categories = await db.category.findMany({
    select: { id: true, popularityCount: true, maxItems: true, axes: true, shortLabel: true }
  })
  const categoryMap = new Map<string, typeof categories[0]>()
  let totalPop = 0
  const axisPop = new Map<string, number>()

  for (const cat of categories) {
    categoryMap.set(cat.id, cat)
    totalPop += cat.popularityCount
    const axes = (cat.axes as string[]) || []
    for (const axis of axes) {
      axisPop.set(axis, (axisPop.get(axis) ?? 0) + cat.popularityCount)
    }
  }

  const axisIDF = new Map<string, number>()
  for (const [axis, pop] of axisPop.entries()) {
    axisIDF.set(axis, Math.log((totalPop + 1) / (pop + 1)))
  }

  // 2. Viewer Profile Data
  const viewerLists = await db.list.findMany({
    where: { profileId, isComplete: true },
    select: { categoryId: true }
  })
  if (viewerLists.length === 0) return

  const viewerCatIds = new Set(viewerLists.map(l => l.categoryId))
  const viewerAxisVec = new Map<string, number>()
  for (const catId of viewerCatIds) {
    const cat = categoryMap.get(catId)
    if (cat) {
      const axes = (cat.axes as string[]) || []
      for (const axis of axes) {
        viewerAxisVec.set(axis, (viewerAxisVec.get(axis) ?? 0) + (axisIDF.get(axis) ?? 0))
      }
    }
  }

  const viewerItemsRaw = await db.listItem.findMany({
    where: { list: { profileId, isComplete: true } },
    select: {
      entityId: true,
      rank: true,
      entity: { select: { canonicalName: true, categoryStats: true } },
      list: { select: { categoryId: true } }
    }
  })

  // Dedupe viewer items: keep best rank per entity per category
  const viewerItems = new Map<string, Map<string, any>>() // catId -> entityId -> item
  for (const item of viewerItemsRaw) {
    const catId = item.list.categoryId
    if (!viewerItems.has(catId)) viewerItems.set(catId, new Map())
    const catMap = viewerItems.get(catId)!
    const existing = catMap.get(item.entityId)
    if (!existing || item.rank < existing.rank) {
      catMap.set(item.entityId, item)
    }
  }

  const viewerEntityIds = Array.from(viewerItems.values()).flatMap(m => Array.from(m.keys()))

  // 3. Candidates Data
  const candidates = await db.profile.findMany({
    where: { id: { not: profileId }, isDiscoverable: true },
    take: 1000,
    orderBy: { id: 'asc' },
    select: { id: true }
  })
  const candidateIds = candidates.map(c => c.id)
  if (candidateIds.length === 0) return

  const candidateLists = await db.list.findMany({
    where: { profileId: { in: candidateIds }, isComplete: true },
    select: { profileId: true, categoryId: true }
  })

  const listsByCandidate = new Map<string, string[]>()
  for (const list of candidateLists) {
    const arr = listsByCandidate.get(list.profileId) ?? []
    arr.push(list.categoryId)
    listsByCandidate.set(list.profileId, arr)
  }

  const candidateItemsRaw = await db.listItem.findMany({
    where: {
      list: { profileId: { in: candidateIds }, categoryId: { in: Array.from(viewerCatIds) }, isComplete: true },
      entityId: { in: viewerEntityIds }
    },
    select: { entityId: true, rank: true, list: { select: { profileId: true, categoryId: true } } }
  })

  // Dedupe candidate items
  const candidateItems = new Map<string, Map<string, Map<string, any>>>() // profileId -> catId -> entityId -> item
  for (const item of candidateItemsRaw) {
    const pId = item.list.profileId
    const catId = item.list.categoryId
    if (!candidateItems.has(pId)) candidateItems.set(pId, new Map())
    const pMap = candidateItems.get(pId)!
    if (!pMap.has(catId)) pMap.set(catId, new Map())
    const catMap = pMap.get(catId)!
    const existing = catMap.get(item.entityId)
    if (!existing || item.rank < existing.rank) {
      catMap.set(item.entityId, item)
    }
  }

  // 4. Calculate Scores
  const upsertPromises = []
  const deletePromises = []

  for (const candidateId of candidateIds) {
    const candidateCatIdsArray = listsByCandidate.get(candidateId) ?? []
    const candidateCatIds = new Set(candidateCatIdsArray)
    
    // Axis Score
    const candidateAxisVec = new Map<string, number>()
    for (const catId of candidateCatIdsArray) {
      const cat = categoryMap.get(catId)
      if (cat) {
        const axes = (cat.axes as string[]) || []
        for (const axis of axes) {
          candidateAxisVec.set(axis, (candidateAxisVec.get(axis) ?? 0) + (axisIDF.get(axis) ?? 0))
        }
      }
    }
    const cosSim = computeCosineSimilarity(viewerAxisVec, candidateAxisVec)
    const axisConfidence = Math.min(1, Math.min(viewerCatIds.size, candidateCatIds.size) / SCORING_CONFIG.AXIS_CONFIDENCE_DIVISOR)
    const axisScore = Math.min(SCORING_CONFIG.MAX_AXIS_POINTS, cosSim * axisConfidence * SCORING_CONFIG.MAX_AXIS_POINTS)

    // Exact Overlap Score
    const sharedCategories = candidateCatIdsArray.filter(id => viewerCatIds.has(id))
    let exactScoreAvg = 0
    let sharedItemsCount = 0
    const sharedFavorites: { categoryShortLabel: string; entityName: string, usageCount: number, popCount: number, rarityW: number, rankSim: number }[] = []

    if (sharedCategories.length > 0) {
      const allMatches = []
      
      for (const catId of sharedCategories) {
        const cat = categoryMap.get(catId)!
        const vMap = viewerItems.get(catId)
        if (!vMap) continue

        const cMap = candidateItems.get(candidateId)?.get(catId)
        if (!cMap) continue

        for (const [entityId, vItem] of vMap.entries()) {
          const cItem = cMap.get(entityId)
          if (cItem) {
            const stats = vItem.entity.categoryStats as { categoryId: string, usageCount: number }[]
            const stat = stats.find(s => s.categoryId === catId)
            const usageCount = stat ? stat.usageCount : 0
            const popCount = Math.max(1, cat.popularityCount)
            
            // Scaled -ln(p) rarity weight against 1% baseline
            // If popCount is 0, p becomes > 1. Math.min limits to 1, Math.log(>1) is >0, -Math.log(p) is <0, Math.max limits to 0. So it handles 0 gracefully.
            let p = usageCount / popCount
            if (popCount === 0 || Number.isNaN(p) || p > 1) p = 1
            if (p < 0.0001) p = 0.0001
            
            let rarityW = Math.max(0, Math.min(1, -Math.log(p) / -Math.log(SCORING_CONFIG.RARITY_BASELINE)))
            
            if (Number.isNaN(rarityW)) {
              console.warn(`Skipping item ${entityId} due to NaN rarity (usage: ${usageCount}, pop: ${popCount})`)
              continue
            }
            
            const rankSim = 1 - (Math.abs(vItem.rank - cItem.rank) / Math.max(1, cat.maxItems - 1))
            const itemScore = rarityW * (0.5 + 0.5 * rankSim)
            
            allMatches.push({ catId, entityId, itemScore, rarityW, rankSim, catMaxItems: Math.max(1, cat.maxItems), shortLabel: cat.shortLabel, entityName: vItem.entity.canonicalName, usageCount, popCount })
          }
        }
      }
      
      // Global entity deduplication (keep best match per entity)
      allMatches.sort((a, b) => b.itemScore - a.itemScore || a.catId.localeCompare(b.catId))
      const seenEntities = new Set<string>()
      
      const catScores = new Map<string, number>()
      for (const catId of sharedCategories) catScores.set(catId, 0)
      
      for (const m of allMatches) {
        if (!seenEntities.has(m.entityId)) {
          seenEntities.add(m.entityId)
          sharedItemsCount++
          catScores.set(m.catId, catScores.get(m.catId)! + m.itemScore)
          sharedFavorites.push({
            categoryShortLabel: m.shortLabel,
            entityName: m.entityName,
            usageCount: m.usageCount,
            popCount: m.popCount,
            rarityW: m.rarityW,
            rankSim: m.rankSim
          })
        }
      }

      let sumCategoryScores = 0
      for (const [catId, sumScore] of catScores.entries()) {
        const cat = categoryMap.get(catId)!
        sumCategoryScores += Math.min(1, sumScore / Math.max(1, cat.maxItems))
      }
      
      const n = sharedCategories.length
      // Shrinkage towards zero when there are few shared categories
      exactScoreAvg = (sumCategoryScores / n) * (n / (n + SCORING_CONFIG.SHRINKAGE_K))
    }

    const exactScore = exactScoreAvg * SCORING_CONFIG.MAX_EXACT_POINTS
    const totalScore = Math.round(exactScore + axisScore)

    const [profileIdA, profileIdB] = canonicalizePair(profileId, candidateId)

    // Store axis-only matches only above a floor
    if (totalScore < SCORING_CONFIG.AXIS_ONLY_FLOOR && sharedItemsCount === 0) {
      deletePromises.push(
        db.compatibilityScore.deleteMany({
          where: { profileIdA, profileIdB }
        })
      )
      continue
    }

    // Sort shared favorites by rarity descending, then alphabetical
    sharedFavorites.sort((a, b) => {
      if (Math.abs(b.rarityW - a.rarityW) > 0.01) {
        return b.rarityW - a.rarityW
      }
      return a.entityName.localeCompare(b.entityName)
    })

    const insights: { icon: string; title: string; description: string }[] = []
    if (sharedFavorites.length >= 5) {
      insights.push({
        icon: 'shared-taste',
        title: 'Shared taste',
        description: `You both love ${sharedFavorites.slice(0, 2).map((s) => s.entityName).join(' and ')}.`,
      })
    } else if (sharedFavorites.length >= 1) {
      insights.push({
        icon: 'shared-taste',
        title: 'Something in common',
        description: `You both picked ${sharedFavorites[0]!.entityName} for ${sharedFavorites[0]!.categoryShortLabel}.`,
      })
    } else if (sharedItemsCount === 0) {
      // Axis-only fallback copy
      const sharedAxes: string[] = []
      for (const axis of viewerAxisVec.keys()) {
        if (candidateAxisVec.has(axis) && axis !== 'Uncategorized') {
          sharedAxes.push(axis)
        }
      }
      if (sharedAxes.length > 0) {
        const displayAxes = sharedAxes.slice(0, 2).map(a => a.charAt(0).toUpperCase() + a.slice(1).replace(/-/g, ' ')).join(' and ')
        insights.push({
          icon: 'shared-taste',
          title: 'Similar taste',
          description: `Similar taste in ${displayAxes}.`
        })
      }
    }

    // Rare overlap: rarityW >= 0.8
    const rare = sharedFavorites.find((s) => s.rarityW >= 0.8)
    if (rare) {
      insights.push({
        icon: 'rare-overlap',
        title: 'Rare overlap',
        description: `You both picked ${rare.entityName} — not many people do.`,
      })
    }

    upsertPromises.push(db.compatibilityScore.upsert({
      where: { profileIdA_profileIdB: { profileIdA, profileIdB } },
      update: {
        score: totalScore,
        sharedItemsCount,
        sharedFavorites: sharedFavorites.map(f => ({ categoryShortLabel: f.categoryShortLabel, entityName: f.entityName })),
        insights
      },
      create: {
        profileIdA,
        profileIdB,
        score: totalScore,
        sharedItemsCount,
        sharedFavorites: sharedFavorites.map(f => ({ categoryShortLabel: f.categoryShortLabel, entityName: f.entityName })),
        insights
      }
    }))
  }

  const chunkSize = 100
  for (let i = 0; i < upsertPromises.length; i += chunkSize) {
    await db.$transaction(upsertPromises.slice(i, i + chunkSize))
  }
  
  if (deletePromises.length > 0) {
    for (let i = 0; i < deletePromises.length; i += chunkSize) {
      await db.$transaction(deletePromises.slice(i, i + chunkSize))
    }
  }
}
