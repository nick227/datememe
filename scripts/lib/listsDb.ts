import { execFileSync } from 'child_process'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import mysql from 'mysql2/promise'
import { key, legacyAsciiKey } from '../../apps/server/src/lib/identityKey'

// Shared by the list-values tooling (docs/list-values-runbook.md): the proven
// production target, the read-only session, and catalog entry ↔ list mapping.

export const ROOT = resolve(__dirname, '../..')
export const LISTS_DIR = resolve(ROOT, 'catalog/lists')

export function die(message: string): never {
  console.error(`✗ ${redact(message)}`)
  process.exit(1)
}

export const redact = (s: string) => s.replace(/mysql:\/\/[^@\s]*@/g, 'mysql://***@')

/** Minimal .env reader: these scripts only need two keys and must not depend on dotenv. */
function readEnvFile(): Record<string, string> {
  const file = resolve(ROOT, '.env')
  if (!existsSync(file)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}

function hostPort(url: string) {
  const u = new URL(url)
  return `${u.hostname}:${u.port || '3306'}`
}

export type Target = { name: 'production' | 'local'; url: string; where: string }

/** Resolves the database URL and proves it is the intended target. Never prints credentials. */
export function resolveTarget(o: { local?: boolean; url?: string }): Target {
  const env = { ...readEnvFile(), ...process.env } as Record<string, string | undefined>
  if (o.local) {
    const url = env.DATABASE_URL
    if (!url) die('--local: no DATABASE_URL in .env')
    if (hostPort(url) === env.RAILWAY_DATEMEME_DATABASE_PROXY) die('--local: DATABASE_URL points at the production proxy; drop --local')
    return { name: 'local', url, where: `db=${hostPort(url)}` }
  }
  const proxy = env.RAILWAY_DATEMEME_DATABASE_PROXY
  if (!proxy) die('RAILWAY_DATEMEME_DATABASE_PROXY is not set in .env; cannot verify the target')
  let url = o.url
  if (!url) {
    try {
      url = execFileSync('railway', ['variables', '--service', 'MySQL', '--environment', 'production', '--kv'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
        .split('\n').find((l) => l.startsWith('MYSQL_PUBLIC_URL='))?.slice('MYSQL_PUBLIC_URL='.length).trim()
    } catch (error: any) {
      die(`railway CLI failed (${String(error.stderr ?? error.message).trim().split('\n').pop()}); run \`railway login\` / \`railway link\`, or pass --url`)
    }
    if (!url) die('MySQL in production has no MYSQL_PUBLIC_URL (enable public networking) — or pass --url')
  }
  let actual: string
  try { actual = hostPort(url) } catch { die('the database URL is not a valid mysql:// URL') }
  if (actual !== proxy) die(`target mismatch: URL points at ${actual}, RAILWAY_DATEMEME_DATABASE_PROXY is ${proxy}. Refusing to run.`)
  return { name: 'production', url, where: `proxy=${proxy}` }
}

/** Opens one connection, locks it read-only, and proves a write is refused before returning it. */
export async function openReadOnly(url: string) {
  const conn = await mysql.createConnection({ uri: url, connectTimeout: 15000, dateStrings: true, supportBigNumbers: true, bigNumberStrings: false })
  await conn.query('SET SESSION TRANSACTION READ ONLY')
  // A write that matches no rows, so it is harmless even if the lock failed.
  // Under a read-only session MySQL/MariaDB refuse it before looking at rows.
  try {
    await conn.query(`UPDATE Category SET slug = slug WHERE id = '__list_values_readonly_probe__'`)
  } catch (error: any) {
    if (error.errno === 1792) return conn // ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION
    await conn.end()
    throw new Error(`read-only probe failed unexpectedly: ${error.code ?? error.message}`)
  }
  await conn.end()
  throw new Error('read-only probe was NOT refused — this session can write. Aborting before any read.')
}

export async function connect(o: { local?: boolean; url?: string }) {
  const target = resolveTarget(o)
  try {
    const conn = await openReadOnly(target.url)
    console.log(`target=${target.name} ${target.where} readonly=verified`)
    return { target, conn }
  } catch (error: any) {
    die(String(error.message))
  }
}

// ── Catalog files ────────────────────────────────────────────────────────────

export type Entry = { categorySlug?: string; adminEditedAt?: string | null; title?: string; values?: unknown[]; [k: string]: unknown }
export type CatalogFile = { name: string; path: string; array: boolean; entries: Entry[]; style: FileStyle; exact: boolean }
export type FileStyle = 'std' | 'compact' | 'compact-inline-values'
const STYLES: FileStyle[] = ['std', 'compact', 'compact-inline-values']

/** The file's JSON style, so a rewrite changes only what it must. Null: no known style reproduces it. */
function styleOf(text: string, data: unknown): FileStyle | null {
  return STYLES.find((style) => formatJson(data, style) === text) ?? null
}

/**
 * std: JSON.stringify(…, 2). compact, as the hand-written batches are: string
 * arrays other than "values" (axes, alsoExpands…) and flat objects (createGroup…)
 * on one line; compact-inline-values also keeps "values" on one line.
 */
export function formatJson(data: unknown, style: FileStyle): string {
  if (style === 'std') return JSON.stringify(data, null, 2) + '\n'
  const flat = (v: object) => Object.values(v).every((x) => x === null || typeof x !== 'object')
  const walk = (v: unknown, indent: string, keyName?: string): string => {
    if (Array.isArray(v)) {
      if (!v.length) return '[]'
      if ((keyName !== 'values' || style === 'compact-inline-values') && v.every((x) => typeof x === 'string')) return `[${v.map((x) => JSON.stringify(x)).join(', ')}]`
      return `[\n${v.map((x) => `${indent}  ${walk(x, `${indent}  `)}`).join(',\n')}\n${indent}]`
    }
    if (v && typeof v === 'object') {
      const e = Object.entries(v)
      if (!e.length) return '{}'
      if (indent && flat(v)) return `{ ${e.map(([k, x]) => `${JSON.stringify(k)}: ${JSON.stringify(x)}`).join(', ')} }`
      return `{\n${e.map(([k, x]) => `${indent}  ${JSON.stringify(k)}: ${walk(x, `${indent}  `, k)}`).join(',\n')}\n${indent}}`
    }
    return JSON.stringify(v)
  }
  return walk(data, '') + '\n'
}

export function loadCatalog(): CatalogFile[] {
  return readdirSync(LISTS_DIR).filter((n) => n.endsWith('.json')).sort().map((name) => {
    const path = resolve(LISTS_DIR, name)
    const text = readFileSync(path, 'utf8')
    const data = JSON.parse(text)
    const array = Array.isArray(data)
    const style = styleOf(text, data)
    return { name, path, array, entries: array ? data : [data], style: style ?? 'std', exact: !!style }
  })
}

export const serializeCatalogFile = (f: CatalogFile) => formatJson(f.array ? f.entries : f.entries[0], f.style)

export type EntryRef = { file: CatalogFile; entry: Entry }

/**
 * Which list each catalog entry updates, decided exactly as the importer does
 * (ListImporterService.importList): a pin, else slug = key(title) or its legacy
 * ASCII form, else the first list with that exact title. Lists: every category, active or not.
 */
export function mapEntriesToLists(files: CatalogFile[], lists: { slug: string; title: string }[]) {
  const slugs = new Set(lists.map((l) => l.slug))
  const byTitle = new Map<string, string>()
  for (const l of lists) if (!byTitle.has(l.title)) byTitle.set(l.title, l.slug)
  const bySlug = new Map<string, EntryRef>()
  for (const file of files) {
    for (const entry of file.entries) {
      const title = typeof entry.title === 'string' ? entry.title : ''
      const target = entry.categorySlug
        ?? [key(title), legacyAsciiKey(title)].find((s) => slugs.has(s))
        ?? byTitle.get(title)
      if (target && !bySlug.has(target)) bySlug.set(target, { file, entry })
    }
  }
  return bySlug
}
