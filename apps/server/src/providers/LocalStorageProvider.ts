import { writeFile, unlink, mkdir } from 'fs/promises'
import { resolve } from 'path'
import { randomUUID } from 'crypto'
import type { StorageProvider, UploadResult } from './storage'
import { localStorageConfig } from './localStorageConfig'

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'application/pdf': '.pdf',
}

export class LocalStorageProvider implements StorageProvider {
  private readonly config = localStorageConfig()

  async upload({
    buffer,
    mimeType,
  }: {
    buffer: Buffer
    originalName: string
    mimeType: string
  }): Promise<UploadResult> {
    // The extension comes from the validated type, never a client filename.
    const ext = MIME_TO_EXT[mimeType]
    if (!ext) throw { statusCode: 415, message: 'Unsupported media type' }
    const key = `${randomUUID()}${ext}`

    await mkdir(this.config.directory, { recursive: true })
    await writeFile(resolve(this.config.directory, key), buffer, { flag: 'wx' })

    return {
      url: `${this.config.baseUrl}/uploads/${key}`,
      key,
      mimeType,
      size: buffer.length,
    }
  }

  async delete(key: string): Promise<void> {
    // Reject any key containing path components — belt and suspenders on top of UUID generation.
    if (!/^[0-9a-f-]{36}\.[a-z0-9]+$/i.test(key)) {
      throw { statusCode: 400, message: 'Invalid key' }
    }
    const filePath = resolve(this.config.directory, key)
    // Silently succeed if file is already gone — idempotent delete.
    await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
  }
}
