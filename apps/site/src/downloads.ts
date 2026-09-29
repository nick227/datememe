import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const MAX_EVENTS = 200
const FILE_NAME = 'downloads.json'

type DownloadEvent = {
  at: string
  version: string
  build: number
  userAgent: string
}

type DownloadLog = {
  total: number
  events: DownloadEvent[]
}

export function downloadCount(releasesDir: string): number {
  return readLog(releasesDir).total
}

export function recordDownload(releasesDir: string, release: { version: string; build: number }, userAgent: string): number {
  const log = readLog(releasesDir)
  log.total += 1
  log.events.push({
    at: new Date().toISOString(),
    version: release.version,
    build: release.build,
    userAgent: userAgent.slice(0, 300),
  })
  if (log.events.length > MAX_EVENTS) log.events.splice(0, log.events.length - MAX_EVENTS)
  const file = path.join(releasesDir, FILE_NAME)
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(log)}\n`)
  renameSync(tmp, file)
  return log.total
}

function readLog(releasesDir: string): DownloadLog {
  const file = path.join(releasesDir, FILE_NAME)
  if (!existsSync(file)) return { total: 0, events: [] }
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (!isLog(parsed)) throw new Error('downloads.json is invalid')
  return parsed
}

function isLog(value: unknown): value is DownloadLog {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.total === 'number' && Array.isArray(record.events)
}
