import { execSync } from 'child_process'
import { existsSync, copyFileSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '..')

function run(cmd: string, label: string) {
  console.log(`\n→ ${label}`)
  execSync(cmd, { stdio: 'inherit', cwd: root })
  console.log(`✓ ${label}`)
}

// .env setup
const envPath = resolve(root, '.env')
const envExample = resolve(root, '.env.example')
if (!existsSync(envPath)) {
  copyFileSync(envExample, envPath)
  console.log('\n⚠  .env created from .env.example')
  console.log('   Edit DATABASE_URL before continuing, then re-run bootstrap.\n')
  process.exit(0)
}

console.log('🚀 Bootstrapping project...\n')

run('pnpm install', 'Install dependencies')
run('pnpm --filter @project/db exec prisma generate', 'Generate Prisma client')
run('pnpm --filter @project/db build', 'Build @project/db (consumed as compiled JS by server/worker)')
run('pnpm db:migrate:deploy', 'Apply database migrations (existing databases must be baselined first)')
run('pnpm sdk:generate', 'Generate SDK types from OpenAPI spec')
run('pnpm db:seed', 'Seed development data')

console.log('\n✅  Bootstrap complete.')
console.log('   Run `pnpm dev` to start the app.')
console.log('   API:    http://localhost:3001')
console.log('   Docs:   http://localhost:3001/docs')
console.log('   Mobile: cd apps/mobile && pnpm start\n')
