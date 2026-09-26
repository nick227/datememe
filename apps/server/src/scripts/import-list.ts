import { readFileSync } from 'fs'
import { ListImporterService, ListSeedInput } from '../services/ListImporterService'

async function run() {
  const filePath = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')

  if (!filePath) {
    console.error('Usage: npx tsx src/scripts/import-list.ts <path-to-json> [--dry-run]')
    process.exit(1)
  }

  const fileContent = readFileSync(filePath, 'utf-8')
  const json: ListSeedInput = JSON.parse(fileContent)

  const service = new ListImporterService()
  
  console.log(`\nImporting: ${json.title} ${dryRun ? '(DRY RUN)' : ''}`)
  const report = await service.importList(json, dryRun)

  console.log('\n--- IMPORT REPORT ---')
  console.log(`Status: ${report.status}`)
  console.log(`Category Slug: ${report.categorySlug}`)
  console.log(`Entities Created: ${report.entitiesCreated.length}`)
  console.log(`Entities Reused: ${report.entitiesReused.length}`)
  
  if (report.errors.length > 0) {
    console.log('\nErrors:')
    report.errors.forEach(e => console.log(` - ${e}`))
  }
}

run().catch(console.error).finally(() => process.exit(0))
