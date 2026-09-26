import { db } from '@project/db'
import { calculateMatchesJob } from '../jobs/CalculateMatchesJob'
import { updateTaxonomyJob } from '../jobs/UpdateTaxonomyJob'
import * as crypto from 'crypto'

const NUM_USERS = 200
const NUM_CLUSTERS = 3
const LAUNCH_SCALE = 100 // completed lists per category average
const TARGET_SCORE_RANGE = [60, 80] // "strong same-cluster match lands at 60-80"

function randomInt(max: number) { return Math.floor(Math.random() * max) }
function randomNormal(mean: number, stdDev: number) {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  num = num / 10.0 + 0.5; // Translate to 0 -> 1
  if (num > 1 || num < 0) return randomNormal(mean, stdDev); 
  return mean + (num - 0.5) * stdDev * 2;
}

// Zipf distribution sampler
function sampleZipf(s: number, N: number) {
  const sum = Array.from({length: N}).reduce((acc: number, _, i) => acc + 1 / Math.pow(i + 1, s), 0)
  const r = Math.random() * sum
  let curr = 0
  for (let i = 1; i <= N; i++) {
    curr += 1 / Math.pow(i, s)
    if (curr >= r) return i - 1
  }
  return N - 1
}

async function runCalibration() {
  console.log('--- SYNTHETIC CALIBRATION FOR DATEMEME MVP ---')

  const categories = await db.category.findMany({ include: { curatedEntities: { select: { entityId: true } } } })
  console.log(`Loaded ${categories.length} categories.`)

  // Create synthetic users
  console.log('Creating synthetic users & lists...')
  
  // Clean up old synthetic users
  await db.user.deleteMany({ where: { email: { startsWith: 'synth_' } } })

  const profiles: any[] = []
  
  for (let i = 0; i < NUM_USERS; i++) {
    const clusterId = i % NUM_CLUSTERS
    const isPowerUser = Math.random() < 0.1 // 10% power users
    const listCount = isPowerUser ? randomInt(categories.length - 5) + 5 : randomInt(3) + 1

    const user = await db.user.create({
      data: {
        email: `synth_${i}@datememe.com`,
        profile: {
          create: {
            username: `synth_${i}`,
            displayName: `Synth ${i}`,
            birthdate: new Date('1995-01-01'),
            bio: `CLUSTER_${clusterId}` // Store ground truth cluster
          }
        }
      },
      include: { profile: true }
    })
    
    profiles.push(user.profile)
    
    // Shuffle categories for this user, slightly biased by cluster
    let catPool = [...categories]
    // simple clustering bias: shift array based on cluster
    catPool = catPool.sort((a, b) => {
       const aC = a.id.charCodeAt(0) % NUM_CLUSTERS
       const bC = b.id.charCodeAt(0) % NUM_CLUSTERS
       if (aC === clusterId && bC !== clusterId) return -1
       if (bC === clusterId && aC !== clusterId) return 1
       return Math.random() - 0.5
    })

    const selectedCats = catPool.slice(0, listCount)
    
    for (const cat of selectedCats) {
       const list = await db.list.create({
         data: { profileId: user.profile!.id, categoryId: cat.id, isComplete: true }
       })
       
       const entities = cat.curatedEntities.map(e => e.entityId)
       // Zipf sample with cluster offset
       const offset = clusterId * 5
       
       const selectedEntities = new Set<string>()
       while (selectedEntities.size < cat.minItems && selectedEntities.size < entities.length) {
         let idx = sampleZipf(1.5, entities.length)
         idx = (idx + offset) % entities.length
         selectedEntities.add(entities[idx])
       }
       
       let rank = 1
       for (const entityId of selectedEntities) {
         // rank noise
         const finalRank = Math.max(1, rank + Math.floor(randomNormal(0, 2)))
         await db.listItem.create({
           data: { listId: list.id, entityId, rank: finalRank }
         })
         rank++
       }
    }
  }

  // Recalculate taxonomy
  console.log('Recalculating taxonomy...')
  const synthLists = await db.list.findMany({ where: { profile: { username: { startsWith: 'synth_' } } } })
  const catIds = Array.from(new Set(synthLists.map(l => l.categoryId)))
  // Let's just run recalc script logic here directly for speed
  for (const catId of catIds) {
    const count = await db.list.count({ where: { categoryId: catId, isComplete: true } })
    await db.category.update({ where: { id: catId }, data: { popularityCount: count } })
  }
  
  const synthEntityIds = await db.listItem.findMany({ 
    where: { list: { profile: { username: { startsWith: 'synth_' } } } }, 
    select: { entityId: true }, distinct: ['entityId'] 
  }).then(r => r.map(x => x.entityId))

  for (const entityId of synthEntityIds) {
    const items = await db.listItem.findMany({
      where: { entityId, list: { isComplete: true } },
      select: { list: { select: { profileId: true, categoryId: true } } }
    })
    
    const usageByCategory: Record<string, number> = {}
    const categoryProfiles = new Map<string, Set<string>>()
    for (const item of items) {
      if (!categoryProfiles.has(item.list.categoryId)) categoryProfiles.set(item.list.categoryId, new Set())
      categoryProfiles.get(item.list.categoryId)!.add(item.list.profileId)
    }
    for (const [catId, set] of categoryProfiles.entries()) usageByCategory[catId] = set.size
    
    await db.entity.update({ where: { id: entityId }, data: { usageCount: new Set(items.map(i => i.list.profileId)).size } })
    for (const [catId, count] of Object.entries(usageByCategory)) {
      await db.entityCategoryStat.upsert({
        where: { entityId_categoryId: { entityId, categoryId: catId } },
        update: { usageCount: count },
        create: { entityId, categoryId: catId, usageCount: count }
      })
    }
  }

  // Clear matches
  await db.compatibilityScore.deleteMany()

  // Run matches
  console.log('Running matching engine...')
  for (const p of profiles) {
    await calculateMatchesJob({ profileId: p.id })
  }

  // Evaluate
  console.log('\n--- EVALUATION RESULTS ---')
  const scores = await db.compatibilityScore.findMany()
  const pMap = new Map<string, any>()
  for (const p of profiles) pMap.set(p.id, p)


  let sameClusterCount = 0
  let crossClusterCount = 0
  let sameClusterScores: number[] = []
  let crossClusterScores: number[] = []

  let axisOnlyScores: number[] = []
  
  const scoreByListCount = new Map<number, number[]>()

  for (const s of scores) {
    const pA = pMap.get(s.profileIdA)
    const pB = pMap.get(s.profileIdB)
    if (!pA || !pB) continue
    
    const clusterA = pA.bio
    const clusterB = pB.bio
    const listCountA = await db.list.count({ where: { profileId: pA.id, isComplete: true } })
    const listCountB = await db.list.count({ where: { profileId: pB.id, isComplete: true } })
    const maxListCount = Math.max(listCountA, listCountB)
    
    if (!scoreByListCount.has(maxListCount)) scoreByListCount.set(maxListCount, [])
    scoreByListCount.get(maxListCount)!.push(s.score)

    if (clusterA === clusterB) {
      sameClusterCount++
      sameClusterScores.push(s.score)
    } else {
      crossClusterCount++
      crossClusterScores.push(s.score)
    }

    if (s.sharedItemsCount === 0) {
      axisOnlyScores.push(s.score)
    }
  }

  const avgSame = sameClusterScores.length ? sameClusterScores.reduce((a, b) => a + b, 0) / sameClusterScores.length : 0
  const avgCross = crossClusterScores.length ? crossClusterScores.reduce((a, b) => a + b, 0) / crossClusterScores.length : 0
  const maxAxisOnly = axisOnlyScores.length ? Math.max(...axisOnlyScores) : 0

  console.log(`Stored rows: ${scores.length} total`)
  console.log(`Rows per profile average: ${(scores.length * 2) / NUM_USERS}`)
  
  console.log(`\nAverage Score (Same Cluster): ${avgSame.toFixed(1)}`)
  console.log(`Average Score (Cross Cluster): ${avgCross.toFixed(1)}`)
  console.log(`Strong match lands in target range ${TARGET_SCORE_RANGE[0]}-${TARGET_SCORE_RANGE[1]}? ${avgSame >= TARGET_SCORE_RANGE[0] && avgSame <= TARGET_SCORE_RANGE[1] ? '✅' : '❌'}`)
  
  console.log(`\nAxis-Only Matches Ceiling: ${maxAxisOnly}`)

  // Top-k precision (Recovery)
  // For each user, get top 10 matches, see how many are same cluster
  let topKTotal = 0
  let topKSameCluster = 0
  for (const p of profiles) {
    const pScores = scores.filter(s => s.profileIdA === p.id || s.profileIdB === p.id)
                          .sort((a, b) => b.score - a.score)
                          .slice(0, 10)
    
    for (const s of pScores) {
      const otherId = s.profileIdA === p.id ? s.profileIdB : s.profileIdA
      const other = profiles.find(x => x.id === otherId)
      if (other && other.bio === p.bio) {
        topKSameCluster++
      }
      topKTotal++
    }
  }

  console.log(`Top-10 Precision (Recovery of same-cluster): ${((topKSameCluster / Math.max(1, topKTotal)) * 100).toFixed(1)}%`)

  // Power user bias
  let powerAvg = 0
  let regularAvg = 0
  const threshold = 5 // arbitrary threshold for power user list count
  let pC = 0, rC = 0
  for (const [lc, sList] of scoreByListCount.entries()) {
    if (lc >= threshold) { powerAvg += sList.reduce((a,b)=>a+b,0); pC += sList.length }
    else { regularAvg += sList.reduce((a,b)=>a+b,0); rC += sList.length }
  }
  console.log(`Power User Match Avg Score: ${(powerAvg/Math.max(1, pC)).toFixed(1)}`)
  console.log(`Regular User Match Avg Score: ${(regularAvg/Math.max(1, rC)).toFixed(1)}`)

  console.log('\nDone.')
}

runCalibration().catch(console.error).finally(() => process.exit(0))
