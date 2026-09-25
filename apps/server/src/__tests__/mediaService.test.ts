import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readdir, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { db } from '@project/db'
import type { MediaService } from '../services/MediaService'

describe('profile image validation and ownership', () => {
  const owner = `media-test-${randomUUID()}`
  let directory: string
  let service: MediaService
  let png: Buffer
  const uploadedKeys: string[] = []

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'datememe-media-'))
    vi.stubEnv('STORAGE_PROVIDER', 'local')
    vi.stubEnv('UPLOADS_DIR', directory)
    vi.stubEnv('BASE_URL', 'https://media.test')
    vi.stubEnv('UPLOAD_MAX_SIZE_MB', '10')
    const { MediaService: Service } = await import('../services/MediaService')
    service = new Service()
    png = await sharp({ create: { width: 12, height: 8, channels: 3, background: '#235f7d' } }).png().toBuffer()
  })

  afterAll(async () => {
    try {
      if (uploadedKeys.length) await db.mediaAsset.deleteMany({ where: { storageKey: { in: uploadedKeys } } })
      if (directory) await rm(directory, { recursive: true, force: true })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  function file(buffer: Buffer, mimetype = 'image/png', filename = 'photo.png') {
    return { toBuffer: async () => buffer, mimetype, filename }
  }

  it('rejects SVG before reading or storing any bytes', async () => {
    const toBuffer = vi.fn(async () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))
    await expect(service.upload({ toBuffer, mimetype: 'image/svg+xml', filename: 'photo.svg' }, owner))
      .rejects.toMatchObject({ statusCode: 415 })
    expect(toBuffer).not.toHaveBeenCalled()
    expect(await readdir(directory)).toEqual([])
  })

  it.each(['empty', 'html', 'mismatched image'])('rejects %s content without leaving a stored file', async (kind) => {
    const contents = kind === 'empty' ? Buffer.alloc(0) : kind === 'html' ? Buffer.from('<script>alert(1)</script>') : png
    const mimetype = kind === 'mismatched image' ? 'image/jpeg' : 'image/png'
    await expect(service.upload(file(contents, mimetype), owner)).rejects.toMatchObject({ statusCode: 415 })
    expect(await readdir(directory)).toEqual([])
  })

  it('rejects a valid image exceeding the configured byte limit', async () => {
    vi.stubEnv('UPLOAD_MAX_SIZE_MB', String((png.length - 1) / (1024 * 1024)))
    try {
      await expect(service.upload(file(png), owner)).rejects.toMatchObject({ statusCode: 413 })
      expect(await readdir(directory)).toEqual([])
    } finally {
      vi.stubEnv('UPLOAD_MAX_SIZE_MB', '10')
    }
  })

  it('normalizes pixels and orientation, strips metadata, and records the owner', async () => {
    const source = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#235f7d' } })
      .jpeg().withMetadata({ orientation: 6 }).toBuffer()
    const result = await service.upload(file(source, 'image/jpeg', '../../untrusted.html'), owner)
    uploadedKeys.push(result.key)

    expect(result.key).toMatch(/^[0-9a-f-]{36}\.webp$/)
    expect(result.url).toBe(`https://media.test/uploads/${result.key}`)
    expect(result.mimeType).toBe('image/webp')
    const stored = await readFile(join(directory, result.key))
    expect(result.size).toBe(stored.length)
    const metadata = await sharp(stored).metadata()
    expect(metadata).toMatchObject({ format: 'webp', width: 1000, height: 2000 })
    expect(metadata.exif).toBeUndefined()
    expect(metadata.orientation).toBeUndefined()
    const asset = await db.mediaAsset.findFirst({ where: { storageKey: result.key } })
    expect(asset).toMatchObject({ sourceType: 'PROFILE_UPLOAD', metadata: { ownerUserId: owner }, publicUrl: result.url })
  })

  it('prevents another user from deleting a photo, then lets its owner delete it idempotently', async () => {
    const result = await service.upload(file(png), owner)
    uploadedKeys.push(result.key)
    await expect(service.delete(result.key, `${owner}-other`)).rejects.toMatchObject({ statusCode: 404 })
    expect(await readFile(join(directory, result.key))).toBeInstanceOf(Buffer)
    expect(await db.mediaAsset.findFirst({ where: { storageKey: result.key } })).not.toBeNull()

    await service.delete(result.key, owner)
    await expect(readFile(join(directory, result.key))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await db.mediaAsset.findFirst({ where: { storageKey: result.key } })).toBeNull()
    await expect(service.delete(result.key, owner)).resolves.toBeUndefined()
  })
})
