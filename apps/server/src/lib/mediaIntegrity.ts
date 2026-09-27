import { existsSync } from 'fs'
import { resolve } from 'path'
import { localStorageConfig } from '../providers/localStorageConfig'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function usesLocalStorage() {
  return (process.env.STORAGE_PROVIDER ?? 'local') === 'local'
}

/**
 * Local-disk media is only servable when the process writing the file is the
 * one serving it. Running an importer on a dev machine against a remote
 * database writes files to the dev disk while the remote DB records their URLs
 * (the 2026-09-26 incident: 178 production assets pointing at localhost).
 * Refuse that combination before any bytes are written.
 */
export function assertMediaWritesAreServable() {
  if (!usesLocalStorage() || !process.env.DATABASE_URL) return
  const dbHost = new URL(process.env.DATABASE_URL).hostname
  if (LOCAL_HOSTS.has(dbHost)) return
  const { directory, baseUrl } = localStorageConfig()
  if (LOCAL_HOSTS.has(new URL(baseUrl).hostname)) {
    throw new Error(`Refusing media write: database is remote (${dbHost}) but BASE_URL is ${baseUrl}. Run media imports inside the server container (railway ssh --service server).`)
  }
  if (!existsSync(directory)) {
    throw new Error(`Refusing media write: database is remote (${dbHost}) but UPLOADS_DIR ${directory} does not exist here. Run media imports inside the server container (railway ssh --service server).`)
  }
}

/** True when the asset's URL points at this deployment and its file exists. */
export function isServableAsset(asset: { storageKey: string | null; publicUrl: string | null }) {
  if (!asset.publicUrl) return false
  if (!asset.storageKey) return true // provider reference: hotlinked, nothing stored
  if (!usesLocalStorage()) return true // cloud object: no cheap existence check
  const { directory, baseUrl } = localStorageConfig()
  return asset.publicUrl === `${baseUrl}/uploads/${asset.storageKey}` && existsSync(resolve(directory, asset.storageKey))
}
