import { db } from '@project/db'

export async function getQueueMetrics(request: any, reply: any) {
  // In a real app, verify admin role here
  // if (request.user.role !== 'ADMIN') throw { statusCode: 403 }

  const statusCounts = await db.jobQueue.groupBy({
    by: ['status'],
    _count: { id: true }
  })

  const oldestPending = await db.jobQueue.findMany({
    where: { status: 'PENDING' },
    orderBy: { availableAt: 'asc' },
    take: 10
  })

  const latestFailed = await db.jobQueue.findMany({
    where: { status: 'FAILED' },
    orderBy: { updatedAt: 'desc' },
    take: 10
  })

  return reply.send({
    metrics: statusCounts.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id
      return acc
    }, {} as Record<string, number>),
    oldestPending,
    latestFailed
  })
}
