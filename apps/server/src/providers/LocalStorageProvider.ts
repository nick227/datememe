import { writeFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve, extname } from 'path'
import { randomUUID } from 'crypto'
import type { StorageProvider, UploadResult } from './storage'

// Files are stored in apps/server/uploads/ — this file lives at
// apps/server/src/providers/, so two levels up reaches apps/server.
// (The shared plugin template's four-levels-up path was wrong for this
// file's actual location; verified and corrected here.)
const UPLOADS_DIR = resolve(__dirname, '../../uploads')
const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3002').replace(/\/$/, '')

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
  constructor() {
    if (!existsSync(UPLOADS_DIR)) {
      mkdir(UPLOADS_DIR, { recursive: true }).catch(() => {})
    }
  }

  async upload({
    buffer,
    originalName,
    mimeType,
  }: {
    buffer: Buffer
    originalName: string
    mimeType: string
  }): Promise<UploadResult> {
    // Use extension from original filename if present, fall back to MIME map.
    // UUID prefix eliminates path traversal and collision risks.
    const originalExt = extname(originalName).toLowerCase()
    const ext = originalExt || MIME_TO_EXT[mimeType] || ''
    const key = `${randomUUID()}${ext}`

    await writeFile(resolve(UPLOADS_DIR, key), buffer)

    return {
      url: `${BASE_URL}/uploads/${key}`,
      key,
      mimeType,
      size: buffer.length,
    }
  }

  async delete(key: string): Promise<void> {
    // Reject any key containing path components — belt and suspenders on top of UUID generation.
    if (/[/\\.]/.test(key.replace(/\.[a-z0-9]+$/i, ''))) {
      throw { statusCode: 400, message: 'Invalid key' }
    }
    const filePath = resolve(UPLOADS_DIR, key)
    // Silently succeed if file is already gone — idempotent delete.
    await unlink(filePath).catch(() => {})
  }
}
