import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

export function repoRoot(): string {
  let dir = __dirname
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('repo root not found')
}

function hasApk(dir: string): boolean {
  if (!existsSync(dir)) return false
  return readdirSync(dir).some((name) => name.endsWith('.apk'))
}

function inside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function resolveIncoming(root: string): string | null {
  if (process.env.INCOMING_DIR) return process.env.INCOMING_DIR
  const staged = path.join(root, 'apk-incoming')
  if (hasApk(staged)) return staged
  const dropped = path.join(root, 'releases', 'incoming')
  const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH
  if (volume && inside(dropped, volume)) return null
  return dropped
}

export function resolveReleases(root: string): string {
  return process.env.RAILWAY_VOLUME_MOUNT_PATH
    ?? process.env.RELEASES_DIR
    ?? path.join(root, 'apps', 'site', '.data', 'releases')
}
