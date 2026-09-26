import { db } from '@project/db'
import { calculateMatchesJob } from '../jobs/CalculateMatchesJob'

async function snapshot() {
  const profiles = await db.profile.findMany({ where: { isDiscoverable: true } })
  for (const p of profiles) {
    await calculateMatchesJob({ profileId: p.id })
  }
  const scores = await db.compatibilityScore.findMany({
    orderBy: [{ profileIdA: 'asc' }, { profileIdB: 'asc' }]
  })
  console.log(JSON.stringify(scores, null, 2))
}
snapshot().then(() => process.exit(0))
