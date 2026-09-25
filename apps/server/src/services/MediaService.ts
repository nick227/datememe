import { createStorageProvider, type UploadResult } from '../providers/storage'
import sharp from 'sharp'
import { db } from '@project/db'

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

const provider = createStorageProvider()

export class MediaService {
  async upload(file: { toBuffer(): Promise<Buffer>; filename: string; mimetype: string }, ownerUserId: string): Promise<UploadResult> {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      throw { statusCode: 415, message: `File type ${file.mimetype} is not allowed` }
    }

    const maxBytes = Number(process.env.UPLOAD_MAX_SIZE_MB ?? 10) * 1024 * 1024
    const buffer = await file.toBuffer()

    if (buffer.length > maxBytes) {
      throw {
        statusCode: 413,
        message: `File exceeds the ${process.env.UPLOAD_MAX_SIZE_MB ?? 10}MB limit`,
      }
    }

    let normalized: Buffer
    try {
      const input = sharp(buffer, { limitInputPixels: 40_000_000 })
      const metadata = await input.metadata()
      const expected = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' }[file.mimetype]
      if (metadata.format !== expected) throw new Error('Image type does not match its contents')
      normalized = await input.rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer()
    } catch {
      throw { statusCode: 415, message: 'Image could not be decoded or does not match its declared type' }
    }
    const result = await provider.upload({ buffer: normalized, originalName: 'profile.webp', mimeType: 'image/webp' })
    try {
      await db.mediaAsset.create({ data: {
        sourceType: 'PROFILE_UPLOAD', storageKey: result.key, publicUrl: result.url,
        mimeType: result.mimeType, byteSize: result.size, metadata: { ownerUserId },
      } })
    } catch (error) {
      await provider.delete(result.key)
      throw error
    }
    return result
  }

  async delete(key: string, ownerUserId: string): Promise<void> {
    const asset = await db.mediaAsset.findFirst({ where: { storageKey: key, sourceType: 'PROFILE_UPLOAD' } })
    if (!asset) return
    if ((asset.metadata as { ownerUserId?: string } | null)?.ownerUserId !== ownerUserId) {
      throw { statusCode: 404, message: 'Media not found' }
    }
    await provider.delete(key)
    await db.mediaAsset.delete({ where: { id: asset.id } })
  }
}
