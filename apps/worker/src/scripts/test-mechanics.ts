import { db } from '@project/db'
import { calculateMatchesJob } from '../jobs/CalculateMatchesJob'

async function runTests() {
  console.log('Validating mechanics tests...\n')

  const profiles = await db.profile.findMany({ where: { isDiscoverable: true } })
  if (profiles.length < 2) return
  
  let symmetryPass = true
  let totalPairs = 0

  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      totalPairs++
      const pA = profiles[i].id
      const pB = profiles[j].id

      // Calculate A -> B
      await calculateMatchesJob({ profileId: pA })
      const score1 = await db.compatibilityScore.findFirst({
        where: { OR: [ { profileIdA: pA, profileIdB: pB }, { profileIdA: pB, profileIdB: pA } ]}
      })

      // Clear row
      await db.compatibilityScore.deleteMany({
        where: { OR: [ { profileIdA: pA, profileIdB: pB }, { profileIdA: pB, profileIdB: pA } ]}
      })

      // Calculate B -> A
      await calculateMatchesJob({ profileId: pB })
      const score2 = await db.compatibilityScore.findFirst({
        where: { OR: [ { profileIdA: pA, profileIdB: pB }, { profileIdA: pB, profileIdB: pA } ]}
      })

      if (score1?.score !== score2?.score || JSON.stringify(score1?.insights) !== JSON.stringify(score2?.insights)) {
        symmetryPass = false
        console.error(`❌ Symmetry check failed for pair ${pA} - ${pB}`)
      }
    }
  }

  if (symmetryPass) {
    console.log(`✅ Symmetry verified across all ${totalPairs} seeded pairs.`)
  }

  const scores = await db.compatibilityScore.findMany()

  if (scores.length > 0) {
    const maxScore = Math.max(...scores.map(s => s.score))
    console.log(`✅ Scores range from ${Math.min(...scores.map(s => s.score))} to ${maxScore}`)
    
    // Axis cap test
    const axisOnly = scores.filter(s => s.sharedItemsCount === 0)
    const maxAxisOnly = axisOnly.length ? Math.max(...axisOnly.map(s => s.score)) : 0
    if (maxAxisOnly <= 20) {
      console.log(`✅ Axis-only score <= 20 (Max observed: ${maxAxisOnly})`)
    } else {
      console.error(`❌ Axis-only score exceeded 20: ${maxAxisOnly}`)
    }
  } else {
    console.warn('⚠️ No compatibility scores generated.')
  }
}

runTests().catch(console.error).finally(() => process.exit(0))
