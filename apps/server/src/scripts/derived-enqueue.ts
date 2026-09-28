import { db } from '@project/db'

// Queues the rebuilds that follow a catalog publish (rankings, catalog audit).
// DB-only; the worker service picks them up. A job already pending counts —
// this never stacks duplicates. New categories have no user answers
// yet, so the per-list taxonomy/match jobs (queued on list save) don't apply.
async function main() {
  const queue = async (type: string) => {
    const inFlight = await db.jobQueue.findFirst({ where: { type, status: 'PENDING' }, select: { id: true } })
    const job = inFlight ?? await db.jobQueue.create({ data: { type, payload: {} } })
    return { status: inFlight ? 'already-queued' : 'queued', jobId: job.id }
  }
  const rankings = await queue('RANKINGS_REBUILD')
  // List quality signals for Admin → Lists (apps/worker CatalogAuditJob).
  const audit = await queue('CATALOG_AUDIT')
  console.log(`DERIVED ${JSON.stringify({ rankingsRebuild: rankings.status, jobId: rankings.jobId, catalogAudit: audit.status })}`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
