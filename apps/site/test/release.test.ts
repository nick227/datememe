import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { readManifestIdentity } from '../src/axml'
import { downloadCount } from '../src/downloads'
import { publishRelease, readManifest } from '../src/publish'
import { createHandler } from '../src/server'
import { readApkArchive } from '../src/zip'
import { SAMPLE_DATE, SAMPLE_TIME, apkBuffer, binaryManifest } from './fixture'

test('reads versionName and versionCode from binary manifest xml', () => {
  const utf16 = readManifestIdentity(binaryManifest('0.1.8', 18))
  assert.deepEqual(utf16, { version: '0.1.8', build: 18 })
  const utf8 = readManifestIdentity(binaryManifest('1.2.3', 4, true))
  assert.deepEqual(utf8, { version: '1.2.3', build: 4 })
})

test('publish writes release.json from the apk and leaves it alone on the next boot', () => {
  const dirs = tempDirs()
  writeFileSync(path.join(dirs.incoming, 'datememe.apk'), apkBuffer(binaryManifest('0.1.8', 18), SAMPLE_DATE, SAMPLE_TIME, true))
  writeFileSync(path.join(dirs.incoming, 'notes.txt'), 'Fixes the photo picker.\n')
  const first = publishRelease({ incomingDir: dirs.incoming, releasesDir: dirs.releases })
  const second = publishRelease({ incomingDir: dirs.incoming, releasesDir: dirs.releases })
  assert.ok(first)
  assert.deepEqual(second, first)
  assert.equal(first.version, '0.1.8')
  assert.equal(first.build, 18)
  assert.equal(first.builtAt, '2026-09-28T22:30:00Z')
  assert.equal(first.apk, '/downloads/datememe-0.1.8.apk')
  assert.equal(first.latest, '/downloads/datememe-latest.apk')
  assert.equal(first.notes, 'Fixes the photo picker.')
  assert.equal(first.sizeBytes, readFileSync(path.join(dirs.releases, 'datememe-latest.apk')).length)
  assert.equal(readFileSync(path.join(dirs.releases, 'datememe-0.1.8.apk')).equals(readFileSync(path.join(dirs.incoming, 'datememe.apk'))), true)
  rmSync(dirs.root, { recursive: true })
})

test('a notes edit keeps the apk timestamp', () => {
  const dirs = tempDirs()
  writeFileSync(path.join(dirs.incoming, 'app.apk'), apkBuffer(binaryManifest('0.1.8', 18), SAMPLE_DATE, SAMPLE_TIME))
  const first = publishRelease({ incomingDir: dirs.incoming, releasesDir: dirs.releases })
  writeFileSync(path.join(dirs.incoming, 'notes.txt'), 'Updated copy')
  const second = publishRelease({ incomingDir: dirs.incoming, releasesDir: dirs.releases })
  assert.equal(second?.builtAt, first?.builtAt)
  assert.equal(second?.notes, 'Updated copy')
  assert.equal(readManifest(dirs.releases)?.sha256, first?.sha256)
  rmSync(dirs.root, { recursive: true })
})

test('download route counts once and redirects to the latest apk', async () => {
  const dirs = tempDirs()
  const apk = apkBuffer(binaryManifest('0.1.8', 18), SAMPLE_DATE, SAMPLE_TIME)
  writeFileSync(path.join(dirs.incoming, 'app.apk'), apk)
  writeFileSync(path.join(dirs.incoming, 'notes.txt'), 'Careful <script>')
  publishRelease({ incomingDir: dirs.incoming, releasesDir: dirs.releases })
  const server = http.createServer(createHandler(dirs.releases))
  await listen(server)
  const port = addressPort(server)
  const page = await get(port, '/')
  assert.match(page.body, /0\.1\.8/)
  assert.match(page.body, /Build 18/)
  assert.match(page.body, /Sep 28, 2026/)
  assert.match(page.body, /0 downloads/)
  assert.match(page.body, /Careful &lt;script&gt;/)
  assert.doesNotMatch(page.body, /<script>/)
  const download = await get(port, '/download')
  assert.equal(download.status, 302)
  assert.equal(download.headers.location, '/downloads/datememe-latest.apk')
  assert.equal(downloadCount(dirs.releases), 1)
  const file = await get(port, '/downloads/datememe-latest.apk')
  assert.equal(file.status, 200)
  assert.equal(file.bodyBytes.equals(apk), true)
  const archive = readApkArchive(file.bodyBytes)
  assert.equal(archive.builtAt, '2026-09-28T22:30:00Z')
  const again = await get(port, '/')
  assert.match(again.body, /1 download/)
  server.close()
  rmSync(dirs.root, { recursive: true })
})

function tempDirs(): { root: string; incoming: string; releases: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'datememe-site-'))
  const incoming = path.join(root, 'incoming')
  const releases = path.join(root, 'releases')
  mkdirSync(incoming)
  return { root, incoming, releases }
}

function listen(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
}

function addressPort(server: http.Server): number {
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing port')
  return address.port
}

function get(port: number, pathname: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string; bodyBytes: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ port, host: '127.0.0.1', path: pathname }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const bodyBytes = Buffer.concat(chunks)
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: bodyBytes.toString('utf8'), bodyBytes })
      })
    })
    req.on('error', reject)
  })
}
