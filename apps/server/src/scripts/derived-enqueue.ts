import { db } from '@project/db'

// Queues the rebuilds that follow a catalog publish. DB-only; the worker
// service picks the job up. A rankings rebuild already pending or running
// counts — this never stacks duplicates. New categories have no user answers
// yet, so the per-list taxonomy/match jobs (queued on list save) don't apply.
async function main() {
  const inFlight = await db.jobQueue.findFirst({ where: { type: 'RANKINGS_REBUILD', status: { in: ['PENDING', 'RUNNING'] } }, select: { id: true } })
  const job = inFlight ?? await db.jobQueue.create({ data: { type: 'RANKINGS_REBUILD', payload: {} } })
  console.log(`DERIVED ${JSON.stringify({ rankingsRebuild: inFlight ? 'already-queued' : 'queued', jobId: job.id })}`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
