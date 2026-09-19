// Registry source: fullstack-contract-drift-check@1.0.0
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { tmpdir } from 'os'
import { join } from 'path'

const specPath = resolve(__dirname, '../packages/api-spec/openapi.yaml')
const committedPath = resolve(__dirname, '../packages/sdk/src/generated/types.ts')
const tempPath = join(tmpdir(), `types-drift-${Date.now()}.ts`)

execSync(`npx openapi-typescript ${specPath} -o ${tempPath}`, { stdio: 'pipe' })

const committed = readFileSync(committedPath, 'utf8').trim()
const fresh = readFileSync(tempPath, 'utf8').trim()

if (committed !== fresh) {
  console.error('❌  SDK types are out of sync with the OpenAPI spec.')
  console.error('    Run `pnpm sdk:generate` and commit the updated types.ts')
  process.exit(1)
}

console.log('✓  SDK types match the spec')
