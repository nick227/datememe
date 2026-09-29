import { createReadStream, existsSync, statSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { downloadCount, recordDownload } from './downloads'
import { renderPage } from './page'
import { repoRoot, resolveReleases } from './paths'
import { publishRelease, readManifest } from './publish'

const APK_NAME = /^datememe-[A-Za-z0-9._+-]+\.apk$/

export function createHandler(releasesDir: string): http.RequestListener {
  return (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    if (req.method !== 'GET' && req.method !== 'HEAD') return text(res, 405, 'Method not allowed')
    if (pathname === '/health') return json(res, 200, { ok: true })
    if (pathname === '/') return html(res, releasesDir)
    if (pathname === '/release.json') return manifest(res, releasesDir)
    if (pathname === '/download') return download(req, res, releasesDir)
    if (pathname.startsWith('/downloads/')) return apk(req, res, releasesDir, pathname.slice('/downloads/'.length))
    text(res, 404, 'Not found')
  }
}

function html(res: http.ServerResponse, releasesDir: string): void {
  const release = readManifest(releasesDir)
  const body = renderPage(release, release ? downloadCount(releasesDir) : 0)
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(body)
}

function manifest(res: http.ServerResponse, releasesDir: string): void {
  const release = readManifest(releasesDir)
  if (!release) return text(res, 404, 'No APK published yet')
  json(res, 200, release)
}

function download(req: http.IncomingMessage, res: http.ServerResponse, releasesDir: string): void {
  const release = readManifest(releasesDir)
  if (!release) return text(res, 404, 'No APK published yet')
  recordDownload(releasesDir, release, req.headers['user-agent'] ?? '')
  res.writeHead(302, { Location: release.latest, 'Cache-Control': 'no-store' })
  res.end()
}

function apk(req: http.IncomingMessage, res: http.ServerResponse, releasesDir: string, name: string): void {
  if (!APK_NAME.test(name)) return text(res, 404, 'Not found')
  const file = path.resolve(releasesDir, name)
  if (!file.startsWith(`${path.resolve(releasesDir)}${path.sep}`) || !existsSync(file)) return text(res, 404, 'Not found')
  const stat = statSync(file)
  res.writeHead(200, {
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Length': stat.size,
    'Content-Disposition': `attachment; filename="${name}"`,
    'Cache-Control': name === 'datememe-latest.apk' ? 'no-cache' : 'public, max-age=31536000, immutable',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(file).pipe(res)
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

function text(res: http.ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(body)
}

function listenPort(): number {
  if (process.env.PORT) return Number(process.env.PORT)
  if (process.env.RAILWAY_ENVIRONMENT_NAME) throw new Error('PORT is required')
  return 4173
}

if (require.main === module) {
  const release = publishRelease()
  const releasesDir = resolveReleases(repoRoot())
  if (release) console.log(`published ${release.version} build ${release.build}`)
  else console.log('no apk published')
  http.createServer(createHandler(releasesDir)).listen(listenPort())
}
