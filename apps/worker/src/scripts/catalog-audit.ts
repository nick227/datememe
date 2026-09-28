import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { db } from '@project/db'
import { auditCatalog, coverageReport, writeQuality, type DomainConfig } from '../lib/catalogAudit'

// The catalog audit, run locally (against any database — DATABASE_URL, e.g.
// the Railway proxy): the same list-quality pass the worker's CATALOG_AUDIT
// job runs, plus the coverage report the next AI generation batch reads.
//
//   pnpm --filter worker exec tsx src/scripts/catalog-audit.ts            report only
//   pnpm --filter worker exec tsx src/scripts/catalog-audit.ts --apply    also write metadata.quality
//
// Writes catalog/review/coverage.<REVIEW_ENV>.json.

const ROOT = resolve(__dirname, '../../../..')
const REVIEW_ENV = process.env.REVIEW_ENV || 'local'
const OUT = resolve(ROOT, `catalog/review/coverage.${REVIEW_ENV}.json`)
const apply = process.argv.includes('--apply')

async function main() {
  const domains = JSON.parse(readFileSync(resolve(ROOT, 'catalog/domains.json'), 'utf8')) as DomainConfig & { $comment?: unknown }
  delete domains.$comment
  const { catalog, quality } = await auditCatalog()
  const report = coverageReport(catalog, quality, domains as DomainConfig)
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n')
  const written = apply ? await writeQuality(catalog, quality) : 0

  const by = (s: string) => report.domains.filter((d) => d.status === s).map((d) => d.label)
  console.log(`${report.activeLists} active lists / ${report.flaggedLists.length} flagged`)
  for (const f of report.flaggedLists) console.log(`  ⚠ ${f.list} (${f.score}) — ${f.issues.join('; ')}`)
  console.log(`missing: ${by('missing').join(', ') || '—'}`)
  console.log(`thin: ${by('thin').join(', ') || '—'}`)
  console.log(`overrepresented: ${by('overrepresented').join(', ') || '—'}`)
  console.log(`\n${apply ? `Wrote quality for ${written} changed lists.` : 'Report only; --apply writes metadata.quality (the worker also does this on its timer).'} Coverage: ${OUT}`)
  console.log(`CATALOG_AUDIT ${JSON.stringify({ lists: report.activeLists, flagged: report.flaggedLists.length, summary: report.summary, written, coverageFile: OUT })}`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
