import { db } from '@project/db'
import { auditTaxonomyMedia } from './taxonomyMediaAudit'

// Read-only. Run before and after any production media seed, inside the
// server container so file checks see the real volume:
//   railway ssh --service server -- pnpm --filter server audit:media
// Exits 1 when the database and storage disagree. VERBOSE=1 lists every finding.
async function main() {
  const audit = await auditTaxonomyMedia()
  console.log(JSON.stringify(audit.summary, null, 2))
  const verbose = process.env.VERBOSE === '1'
  const show = <T>(title: string, rows: T[]) => {
    if (!rows.length) return
    console.log(`\n${title} (${rows.length})`)
    for (const row of verbose ? rows : rows.slice(0, 10)) console.log(' ', JSON.stringify(row))
    if (!verbose && rows.length > 10) console.log(`  … ${rows.length - 10} more (VERBOSE=1 to list all)`)
  }
  show('Asset problems', audit.assetFindings)
  show('Wikidata ref problems', audit.refFindings)
  show('Entity images that do not resolve', audit.deadEntityImages)
  show('Same image on multiple entities', audit.sharedHashes)
  show('Same cover on multiple lists', audit.sharedCovers)
  show('List covers without a 3:4 card variant', audit.missingCardVariants)
  show('Near-duplicate list covers (covers:improve)', audit.nearDuplicateCovers)
  console.log(audit.healthy ? '\nOK: media is consistent.' : '\nFAIL: media is inconsistent — see repair-taxonomy-media.ts')
  if (!audit.healthy) process.exitCode = 1
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
