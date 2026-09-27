import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '../../../..')
export const CLASSES_SOURCE = resolve(ROOT, 'catalog/identity-classes.json')
export const CLASSES_GENERATED = resolve(ROOT, 'catalog/identity-classes.generated.json')

export function sourceFingerprint(source: string) {
  return createHash('sha256').update(source).digest('hex')
}

/**
 * Per entity type, the Wikidata classes an item may be an instance of: the
 * subclass-expanded map, refused if it was generated from an older
 * identity-classes.json (the generator must be re-run after every edit).
 */
export function loadIdentityClasses(): Record<string, Record<string, string>> {
  const regenerate = 'run: pnpm --filter server exec tsx src/scripts/generate-identity-classes.ts'
  if (!existsSync(CLASSES_GENERATED)) throw new Error(`${CLASSES_GENERATED} is missing; ${regenerate}`)
  const generated = JSON.parse(readFileSync(CLASSES_GENERATED, 'utf8'))
  if (generated.$sourceSha256 !== sourceFingerprint(readFileSync(CLASSES_SOURCE, 'utf8'))) {
    throw new Error(`identity-classes.generated.json is out of date with identity-classes.json; ${regenerate}`)
  }
  return Object.fromEntries(Object.entries(generated).filter(([k]) => !k.startsWith('$'))) as Record<string, Record<string, string>>
}
