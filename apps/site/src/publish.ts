import { copyFileSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { readManifestIdentity } from './axml'
import { repoRoot, resolveIncoming, resolveReleases } from './paths'
import { readApkArchive } from './zip'

export type ReleaseManifest = {
  version: string
  build: number
  builtAt: string
  apk: string
  latest: string
  sizeBytes: number
  notes: string
  sha256: string
}

const LATEST_NAME = 'datememe-latest.apk'
const MANIFEST_NAME = 'release.json'

type PublishDirs = {
  incomingDir: string | null
  releasesDir: string
}

export function publishRelease(dirs?: Partial<PublishDirs>): ReleaseManifest | null {
  const root = repoRoot()
  const incomingDir = dirs?.incomingDir === undefined ? resolveIncoming(root) : dirs.incomingDir
  const releasesDir = dirs?.releasesDir ?? resolveReleases(root)
  mkdirSync(releasesDir, { recursive: true })
  const existing = readManifest(releasesDir)
  if (!incomingDir) return existing
  const apkPath = newestApk(incomingDir)
  if (!apkPath) return existing
  const bytes = readFileSync(apkPath)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const notes = readNotes(incomingDir)
  if (existing?.sha256 === sha256 && existing.notes === notes) return existing
  const archive = readApkArchive(bytes)
  const identity = readManifestIdentity(archive.manifestXml)
  const fileName = `datememe-${safeVersion(identity.version)}.apk`
  copyFileSync(apkPath, path.join(releasesDir, fileName))
  copyFileSync(apkPath, path.join(releasesDir, LATEST_NAME))
  const manifest: ReleaseManifest = {
    version: identity.version,
    build: identity.build,
    builtAt: existing?.sha256 === sha256 ? existing.builtAt : archive.builtAt,
    apk: `/downloads/${fileName}`,
    latest: `/downloads/${LATEST_NAME}`,
    sizeBytes: bytes.length,
    notes,
    sha256,
  }
  writeJson(path.join(releasesDir, MANIFEST_NAME), manifest)
  return manifest
}

export function readManifest(releasesDir: string): ReleaseManifest | null {
  const file = path.join(releasesDir, MANIFEST_NAME)
  if (!existsSync(file)) return null
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (!isManifest(parsed)) throw new Error('release.json is invalid')
  return parsed
}

function newestApk(incomingDir: string): string | null {
  if (!existsSync(incomingDir)) return null
  const files = readdirSync(incomingDir).filter((name) => name.endsWith('.apk'))
  let best: { file: string; builtAt: string } | null = null
  for (const name of files) {
    const file = path.join(incomingDir, name)
    const builtAt = readApkArchive(readFileSync(file)).builtAt
    if (!best || builtAt > best.builtAt) best = { file, builtAt }
  }
  return best?.file ?? null
}

function readNotes(incomingDir: string): string {
  const file = path.join(incomingDir, 'notes.txt')
  if (!existsSync(file)) return ''
  return readFileSync(file, 'utf8').trim()
}

function safeVersion(version: string): string {
  const cleaned = version.replace(/[^A-Za-z0-9._+-]/g, '')
  if (!cleaned) throw new Error(`unusable version name: ${version}`)
  return cleaned
}

function writeJson(file: string, value: ReleaseManifest): void {
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(tmp, file)
}

function isManifest(value: unknown): value is ReleaseManifest {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.version === 'string'
    && typeof record.build === 'number'
    && typeof record.builtAt === 'string'
    && typeof record.apk === 'string'
    && typeof record.latest === 'string'
    && typeof record.sizeBytes === 'number'
    && typeof record.notes === 'string'
    && typeof record.sha256 === 'string'
}
