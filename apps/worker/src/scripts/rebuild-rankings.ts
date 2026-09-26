import { db } from '@project/db'
import { rankingsRebuildJob } from '../jobs/RankingsRebuildJob'

// Runs the same rebuild the worker's timer enqueues, inline — for right after
// a seed/import, or to see the result without waiting for the next tick.
rankingsRebuildJob()
  .then((result) => { console.log(result); return db.$disconnect() })
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1) })
