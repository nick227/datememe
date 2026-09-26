import { execSync } from 'child_process'

async function run() {
  const dbUrl = process.argv[2]
  
  if (!dbUrl || !dbUrl.startsWith('mysql://')) {
    console.error('❌ Error: You must provide a valid Railway MySQL URL.')
    console.error('Usage: npx tsx scripts/seed-production.ts <MYSQL_URL>')
    console.error('Example: npx tsx scripts/seed-production.ts mysql://root:pass@viaduct.proxy.rlwy.net:12345/datememe')
    process.exit(1)
  }

  // Override the environment variable for child processes
  process.env.DATABASE_URL = dbUrl
  
  console.log('🔗 Connecting to remote database:', dbUrl.split('@')[1] || dbUrl)
  console.log('\n=======================================')
  console.log('🚀 STEP 1: Mapping Axes & Pruning Duplicates')
  console.log('=======================================')
  execSync(`env DATABASE_URL="${dbUrl}" npx tsx apps/worker/src/scripts/map-axes.ts`, { stdio: 'inherit' })

  console.log('\n=======================================')
  console.log('🚀 STEP 2: Seeding New Lifestyle Categories & Test Users')
  console.log('=======================================')
  execSync(`env DATABASE_URL="${dbUrl}" npx tsx apps/worker/src/scripts/seed-new-categories.ts`, { stdio: 'inherit' })

  console.log('\n=======================================')
  console.log('🚀 STEP 3: Importing 10 High-Quality Lists')
  console.log('=======================================')
  execSync(`env DATABASE_URL="${dbUrl}" npx tsx apps/server/src/scripts/import-high-quality-lists.ts`, { stdio: 'inherit' })

  console.log('\n=======================================')
  console.log('🚀 STEP 3.5: Importing Batch 4 Lists')
  console.log('=======================================')
  execSync(`env DATABASE_URL="${dbUrl}" npx tsx apps/server/src/scripts/import-batch4.ts`, { stdio: 'inherit' })

  console.log('\n=======================================')
  console.log('🚀 STEP 4: Fetching Wikipedia/Wikidata Media (This might take a minute)')
  console.log('=======================================')
  execSync(`env DATABASE_URL="${dbUrl}" npx tsx apps/server/src/scripts/seed-taxonomy-media.ts`, { stdio: 'inherit' })


  console.log('\n✅ All production seed steps completed successfully!')
}

run().catch((e) => {
  console.error('❌ Script failed:', e)
  process.exit(1)
})
