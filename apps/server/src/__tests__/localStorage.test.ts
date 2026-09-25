import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import Fastify from 'fastify'
import { localStorageConfig } from '../providers/localStorageConfig'
import { LocalStorageProvider } from '../providers/LocalStorageProvider'
import uploadsPlugin from '../plugins/uploads'

afterEach(() => vi.unstubAllEnvs())

describe('hosted local storage configuration', () => {
  it.each([
    [undefined, 'https://media.test'],
    ['/data/uploads', undefined],
    ['relative/uploads', 'https://media.test'],
    ['/data/uploads', 'http://media.test'],
    ['/data/uploads', 'https://user:secret@media.test'],
    ['/data/uploads', 'https://media.test?token=secret'],
    ['/data/uploads', 'https://media.test#fragment'],
    ['/data/uploads', 'file:///data/uploads'],
  ])('rejects unsafe hosted storage configuration (%s, %s)', (directory, baseUrl) => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('UPLOADS_DIR', directory)
    vi.stubEnv('BASE_URL', baseUrl)
    expect(() => localStorageConfig()).toThrow()
  })

  it('uses the explicit hosted volume directory and a normalized HTTPS origin', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('UPLOADS_DIR', '/data/uploads')
    vi.stubEnv('BASE_URL', 'https://media.test/')
    expect(localStorageConfig()).toEqual({ directory: '/data/uploads', baseUrl: 'https://media.test' })
  })
})

describe('persistent local media serving', () => {
  it('serves the same upload after recreating the provider and HTTP server', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'datememe-storage-'))
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STORAGE_PROVIDER', 'local')
    vi.stubEnv('UPLOADS_DIR', directory)
    vi.stubEnv('BASE_URL', 'https://media.test')
    const bytes = Buffer.from('stored image fixture')
    const app = Fastify()
    const restarted = Fastify()
    try {
      const provider = new LocalStorageProvider()
      const uploaded = await provider.upload({ buffer: bytes, mimeType: 'image/webp', originalName: '../../script.html' })
      expect(uploaded.key).toMatch(/^[0-9a-f-]{36}\.webp$/)
      await app.register(uploadsPlugin)
      const first = await app.inject({ method: 'GET', url: new URL(uploaded.url).pathname })
      expect(first.statusCode).toBe(200)
      expect(first.rawPayload).toEqual(bytes)
      await app.close()

      await restarted.register(uploadsPlugin)
      const afterRestart = await restarted.inject({ method: 'GET', url: new URL(uploaded.url).pathname })
      expect(afterRestart.statusCode).toBe(200)
      expect(afterRestart.rawPayload).toEqual(bytes)
      expect(afterRestart.headers['content-type']).toMatch(/^image\/webp/)
      expect(afterRestart.headers['x-content-type-options']).toBe('nosniff')

      const newProvider = new LocalStorageProvider()
      await newProvider.delete(uploaded.key)
      await expect(newProvider.delete(uploaded.key)).resolves.toBeUndefined()
      expect((await restarted.inject({ method: 'GET', url: new URL(uploaded.url).pathname })).statusCode).toBe(404)
    } finally {
      await app.close()
      await restarted.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects path traversal without touching files outside the upload directory', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'datememe-storage-boundary-'))
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('UPLOADS_DIR', join(parent, 'uploads'))
    vi.stubEnv('BASE_URL', 'https://media.test')
    const sentinel = join(parent, 'keep.txt')
    await writeFile(sentinel, 'keep')
    try {
      const provider = new LocalStorageProvider()
      for (const key of ['../keep.txt', '/keep.txt', '..\\keep.txt', '%2e%2e%2fkeep.txt']) {
        await expect(provider.delete(key)).rejects.toMatchObject({ statusCode: 400 })
      }
      expect(await readFile(sentinel, 'utf8')).toBe('keep')
    } finally {
      await rm(parent, { recursive: true, force: true })
    }
  })
})
