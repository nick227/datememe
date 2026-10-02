import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { ROOT, die, loadCatalog, serializeCatalogFile } from './lib/listsDb'

// Appends new values to lists' pinned catalog entries (docs/list-values-runbook.md).
// The content step of a fill batch: you write the names, this does the bookkeeping.
//
//   pnpm prod:list-append <additions.json> [--bound]
//
// additions.json: { "<category slug>": ["New value", …], … }, strongest first.
// Run `pnpm prod:list-stub --list <slug>…` for the same lists first. For each list it
//   - refuses unless the list has exactly one pinned entry
//   - refuses a name already on the entry (case-insensitive) or repeated in the file
//   - refuses going more than 10 past the list's target
//   - with --bound only: records a `lists` floor in catalog/value-floor.json for each list
//     that stops short of its target. That says "the honest answers ran out here", an
//     editorial claim, so it is never implied; without --bound a short list stays depth-gap.
// Writes only catalog files. Reads targets (read-only) through prod:list-values.

const file = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!file) die('usage: pnpm prod:list-append <additions.json> [--bound]   ({ "<category slug>": ["New value", …] })')
const bound = process.argv.includes('--bound')
const add = JSON.parse(readFileSync(resolve(file), 'utf8')) as Record<string, string[]>
const slugs = Object.keys(add)
if (!slugs.length) die('no lists in the additions file')

const out = execFileSync('pnpm', ['-s', 'prod:list-values', '--json', ...slugs.flatMap((s) => ['--list', s])], { cwd: ROOT, encoding: 'utf8' })
const rows = JSON.parse(out.split('\n').find((l) => l.startsWith('['))!) as { slug: string; floor: number; status: string }[]
const target = new Map(rows.map((r) => [r.slug, r.floor]))

const files = loadCatalog()
const touched = new Set<(typeof files)[number]>()
const bounded: Record<string, number> = {}
const lines: string[] = []
const nameOf = (v: unknown) => (typeof v === 'string' ? v : (v as { name: string }).name)
for (const slug of slugs) {
  const names = add[slug]!.map((n) => n.trim()).filter(Boolean)
  if (!target.has(slug)) die(`${slug}: no such active list`)
  const hits = files.flatMap((f) => f.entries.map((e) => ({ f, e }))).filter(({ e }) => e.categorySlug === slug)
  if (hits.length !== 1) die(`${slug}: ${hits.length} pinned entries — run pnpm prod:list-stub --list ${slug}`)
  const { f, e } = hits[0]!
  const values = (e.values as unknown[]) ?? []
  const have = new Set(values.map((v) => nameOf(v).toLowerCase()))
  const seen = new Set<string>()
  for (const n of names) {
    if (have.has(n.toLowerCase())) die(`${slug}: already has "${n}"`)
    if (seen.has(n.toLowerCase())) die(`${slug}: "${n}" twice in the additions`)
    seen.add(n.toLowerCase())
  }
  const total = values.length + names.length
  const goal = target.get(slug)!
  if (total > goal + 10) die(`${slug}: ${total} values would be more than 10 past its target of ${goal}`)
  if (total < goal && bound) bounded[slug] = total
  e.values = [...values, ...names]
  touched.add(f)
  lines.push(`+ ${slug}: ${values.length} → ${total} (target ${goal}${total < goal ? (bound ? `, bounded at ${total}` : ', short of target — pass --bound only if the honest answers ran out') : ''})`)
}
for (const f of touched) writeFileSync(f.path, serializeCatalogFile(f))
if (Object.keys(bounded).length) {
  const path = resolve(ROOT, 'catalog/value-floor.json')
  const vf = JSON.parse(readFileSync(path, 'utf8'))
  Object.assign(vf.lists, bounded)
  writeFileSync(path, JSON.stringify(vf, null, 2) + '\n')
}
console.log(lines.join('\n'))
console.log(`LIST_APPEND ${JSON.stringify({ lists: slugs.length, values: slugs.reduce((n, s) => n + add[s]!.length, 0), bounded, files: [...touched].map((f) => f.name) })}`)
