import { cpSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { repoRoot } from './paths'

export function stageIncoming(from: string, to: string): void {
  mkdirSync(to, { recursive: true })
  for (const name of readdirSync(from)) {
    if (name === 'README.md' || name === '.gitkeep') continue
    const source = path.join(from, name)
    if (!statSync(source).isFile()) continue
    cpSync(source, path.join(to, name))
  }
}

if (require.main === module) {
  const root = repoRoot()
  stageIncoming(path.join(root, 'releases', 'incoming'), path.join(root, 'apk-incoming'))
}
