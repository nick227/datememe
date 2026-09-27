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
  console.log('🚀 STEP 3.6: Importing Batch 5 Lists (Music & Video)')
  console.log('=======================================')
  execSync(`env DATABASE_URL="${dbUrl}" npx tsx apps/server/src/scripts/import-batch5.ts`, { stdio: 'inherit' })

  console.log('\n=======================================')
  console.log('🚀 STEP 3.7: Importing Batch 6 Lists (More Music & Video)')
  console.log('=======================================')
  execSync(`env DATABASE_URL="${dbUrl}" npx tsx apps/server/src/scripts/import-batch6.ts`, { stdio: 'inherit' })

  console.log('\n=======================================')
  console.log('🚀 STEP 3.8: Importing Batch 7 Lists (Memes & Internet Culture)')
  console.log('=======================================')
  execSync(`env DATABASE_URL="${dbUrl}" npx tsx apps/server/src/scripts/import-batch7.ts`, { stdio: 'inherit' })

  console.log('\n=======================================')
  console.log('🚀 STEP 3.9: Importing Batch 8 Lists (Sports & Politics)')
  console.log('=======================================')
  execSync(`env DATABASE_URL="${dbUrl}" npx tsx apps/server/src/scripts/import-batch8.ts`, { stdio: 'inherit' })

  console.log('\n✅ All production seed steps completed successfully!')
  // Media is deliberately not seeded from here: this script runs on your
  // machine, so imported files would land on your disk while production
  // records their URLs. Import media inside the server container instead:
  //   railway ssh --service server -- pnpm --filter server seed:taxonomy-media
  console.log('ℹ️  Media not imported. Run inside the server container:')
  console.log('   railway ssh --service server -- pnpm --filter server seed:taxonomy-media')
}

run().catch((e) => {
  console.error('❌ Script failed:', e)
  process.exit(1)
})
