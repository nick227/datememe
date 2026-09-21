// Storage provider interface — all providers implement this shape.
// Add new providers (R2, S3, GCS) as separate files and register them in the factory below.

export interface UploadResult {
  url: string // publicly accessible URL to serve to clients
  key: string // opaque identifier used for deletion
  mimeType: string
  size: number // bytes
}

export interface StorageProvider {
  upload(options: { buffer: Buffer; originalName: string; mimeType: string }): Promise<UploadResult>

  delete(key: string): Promise<void>
}

// Factory — reads STORAGE_PROVIDER env var, defaults to local.
// Cloud provider files are installed by their respective plugins.
import { LocalStorageProvider } from './LocalStorageProvider'

export function createStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER ?? 'local'

  switch (provider) {
    case 'r2': {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { R2StorageProvider } = require('./R2StorageProvider')
        return new R2StorageProvider()
      } catch {
        throw new Error('R2StorageProvider not found. Install the cloudflare-r2 plugin first.')
      }
    }
    case 's3': {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { S3StorageProvider } = require('./S3StorageProvider')
        return new S3StorageProvider()
      } catch {
        throw new Error('S3StorageProvider not found. Install the aws-s3 plugin first.')
      }
    }
    default: {
      return new LocalStorageProvider()
    }
  }
}
