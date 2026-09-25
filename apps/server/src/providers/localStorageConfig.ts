import { isAbsolute, resolve } from 'path'

export function localStorageConfig() {
  const directory = process.env.UPLOADS_DIR
  const baseUrl = process.env.BASE_URL
  if (process.env.NODE_ENV === 'production' && (!directory || !baseUrl)) {
    throw new Error('Hosted local media requires UPLOADS_DIR on a persistent volume and BASE_URL')
  }
  if (directory && !isAbsolute(directory)) throw new Error('UPLOADS_DIR must be an absolute path')
  const publicBase = new URL(baseUrl ?? 'http://localhost:3002')
  if (publicBase.username || publicBase.password || publicBase.search || publicBase.hash ||
      !['http:', 'https:'].includes(publicBase.protocol) ||
      (process.env.NODE_ENV === 'production' && publicBase.protocol !== 'https:')) {
    throw new Error('BASE_URL must be a public HTTP(S) URL; hosted media requires HTTPS')
  }
  return {
    directory: directory ?? resolve(__dirname, '../../uploads'),
    baseUrl: publicBase.toString().replace(/\/$/, ''),
  }
}
