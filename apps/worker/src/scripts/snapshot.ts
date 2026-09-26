import { db } from '@project/db'

async function snapshot() {
  const scores = await db.compatibilityScore.findMany({
    orderBy: [{ profileIdA: 'asc' }, { profileIdB: 'asc' }]
  })
  console.log(JSON.stringify(scores, null, 2))
}
snapshot().then(() => process.exit(0))
