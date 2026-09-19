import { createStorageProvider, type UploadResult } from '../providers/storage'

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
])

const provider = createStorageProvider()

export class MediaService {
  async upload(file: { toBuffer(): Promise<Buffer>; filename: string; mimetype: string }): Promise<UploadResult> {
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

    return provider.upload({
      buffer,
      originalName: file.filename,
      mimeType: file.mimetype,
    })
  }

  async delete(key: string): Promise<void> {
    return provider.delete(key)
  }
}
