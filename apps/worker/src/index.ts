import { pushNotificationJob } from './jobs/PushNotificationJob'
import { db } from '@project/db'
import { calculateMatchesJob } from './jobs/CalculateMatchesJob'
import { updateTaxonomyJob } from './jobs/UpdateTaxonomyJob'
import { randomUUID } from 'crypto'
import { performance } from 'perf_hooks'

const WORKER_ID = randomUUID()
const MAX_ATTEMPTS = 3
const STALE_LOCK_MINUTES = parseInt(process.env.STALE_LOCK_MINUTES || '5', 10)

let isShuttingDown = false
let currentJobRunning = false

async function poll() {
  if (isShuttingDown) {
    console.log(`Worker ${WORKER_ID} stopped polling due to shutdown.`)
    return
  }

  // 1. Claim a job transactionally using proper MySQL lock pattern
  let job: any = null
  try {
    job = await db.$transaction(async (tx) => {
      // UTC_TIMESTAMP(), not NOW() — Prisma stores every DateTime column in UTC,
      // but NOW() returns the MySQL server's local system time. Whenever the DB
      // host's local timezone lags UTC (the default on most dev machines), that
      // mismatch made every job created after ~7pm local look scheduled hours in
      // the future and it would never get claimed until local time caught up.
      const rows = await tx.$queryRawUnsafe<any[]>(`
        SELECT id FROM JobQueue
        WHERE (status = 'PENDING' AND availableAt <= UTC_TIMESTAMP())
           OR (status = 'RUNNING' AND lockedAt < UTC_TIMESTAMP() - INTERVAL ${STALE_LOCK_MINUTES} MINUTE)
        ORDER BY availableAt ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `)

      if (!rows || rows.length === 0) return null

      const jobId = rows[0].id

      await tx.$queryRawUnsafe(`
        UPDATE JobQueue
        SET status = 'RUNNING', lockedAt = UTC_TIMESTAMP(), lockedBy = ?, attempts = attempts + 1
        WHERE id = ?
      `, WORKER_ID, jobId)
      
      return tx.jobQueue.findUnique({ where: { id: jobId } })
    })
  } catch (err) {
    console.error('Error claiming job from queue:', err)
  }

  if (!job) {
    // No jobs to process, wait and poll again
    setTimeout(poll, 1000)
    return
  }

  currentJobRunning = true
  const startTime = performance.now()

  try {
    const payload = job.payload as any
    if (job.type === 'CALCULATE_MATCHES') {
      await calculateMatchesJob(payload)
    } else if (job.type === 'UPDATE_TAXONOMY') {
      await updateTaxonomyJob(payload)
    } else if (job.type === 'SEND_PUSH_NOTIFICATION') {
      await pushNotificationJob(payload)
    } else {
      throw new Error(`Unknown job type: ${job.type}`)
    }

    // Success
    await db.jobQueue.update({
      where: { id: job.id },
      data: { status: 'DONE', finishedAt: new Date() }
    })
    
    const durationMs = Math.round(performance.now() - startTime)
    console.log(JSON.stringify({ event: 'JOB_SUCCESS', jobId: job.id, type: job.type, attempt: job.attempts, durationMs, workerId: WORKER_ID }))
    
  } catch (error: any) {
    const durationMs = Math.round(performance.now() - startTime)
    console.log(JSON.stringify({ event: 'JOB_FAILED', jobId: job.id, type: job.type, attempt: job.attempts, durationMs, workerId: WORKER_ID, error: error.message }))
    
    // Failure handling
    if (job.attempts >= MAX_ATTEMPTS) {
      await db.jobQueue.update({
        where: { id: job.id },
        data: { status: 'FAILED', lastError: error.message }
      })
    } else {
      // Exponential backoff for retry
      const backoffMinutes = Math.pow(2, job.attempts)
      const availableAt = new Date(Date.now() + backoffMinutes * 60000)
      
      await db.jobQueue.update({
        where: { id: job.id },
        data: { 
          status: 'PENDING', 
          lastError: error.message,
          availableAt
        }
      })
    }
  }

  currentJobRunning = false
  // Poll immediately for the next job
  setImmediate(poll)
}

function handleShutdown() {
  console.log(`Worker ${WORKER_ID} received shutdown signal. Waiting for current job to finish...`)
  isShuttingDown = true
  
  const checkShutdown = setInterval(() => {
    if (!currentJobRunning) {
      console.log(`Worker ${WORKER_ID} cleanly shut down.`)
      clearInterval(checkShutdown)
      process.exit(0)
    }
  }, 500)
}

process.on('SIGTERM', handleShutdown)
process.on('SIGINT', handleShutdown)

console.log(`Worker ${WORKER_ID} started. Polling for jobs...`)
poll()

