import { execFileSync, spawn } from 'child_process'
import { resolve } from 'path'

// The one command for getting catalog lists into a Railway environment:
//
//   pnpm prod:publish-catalog [--env production] [--dry-run] [--skip-media] [--apply-review]
//
// It only coordinates; each stage is its own idempotent command, and the run
// stops at the first failure. Re-running after a failure is always safe.
//
//   preflight          code on this machine == code Railway has deployed; the
//                      catalog is committed; the database schema matches
//                      schema.prisma; DB URL fetched from Railway
//   catalog:validate   local -> Railway MySQL (read-only)
//   catalog:publish    local -> Railway MySQL (DB-only work may run locally)
//   media:identify     local -> Railway MySQL + Wikidata; unsure cases go to
//                      catalog/review/identities.<env>.json and never block
//   covers:propose     local -> Railway MySQL + Openverse; cover candidates for
//                      lists without one go to catalog/review/covers.<env>.json
//                      (+ .html contact sheet) for a person to pick
//   media:sync         inside the server container (writes image files, so it
//                      must run where the volume is), repeated until done
//   derived:enqueue    local -> Railway MySQL (the worker does the rebuild)
//   audit              inside the server container
//
// --dry-run stops after validation. --skip-media skips identify + sync.
// --apply-review first applies your decisions in catalog/review/identities.<env>.json
// and catalog/review/covers.<env>.json.

const root = resolve(__dirname, '..')
const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const envName = args.includes('--env') ? args[args.indexOf('--env') + 1] ?? 'production' : 'production'
const CODE_PATHS = ['apps/server', 'packages/db', 'packages/api-spec']
const DATA_PATHS = ['catalog/lists', 'catalog/identity-classes.json']
const MAX_SYNC_ROUNDS = 20

const summary: Record<string, unknown> = { environment: envName }

function sh(cmd: string, cmdArgs: string[]) {
  return execFileSync(cmd, cmdArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

/** One line per stage, so a run can be judged at a glance. Stages that didn't run are omitted. */
function report() {
  const s = summary as any
  const lines = [`environment: ${envName} @ ${s.deployedCommit ?? '?'}${s.schema ? ', schema matches' : ''}`]
  const catalog = s.publish ?? s.validate
  if (catalog) lines.push(`catalog:     ${catalog.lists} lists checked, ${catalog.newCategories} new categories, ${catalog.newEntities} new entities, ${catalog.errors} errors${s.publish ? '' : ' (validate only)'}`)
  if (s.review) lines.push(`review:      ${s.review.applied} decisions applied, ${s.review.stillPending} still pending`)
  if (s.identify) lines.push(`identity:    ${s.identify.autoAccepted} accepted, ${s.identify.toReview} to review, ${s.identify.remaining} not yet checked${s.identify.stoppedEarly ? ' (rate-limited, resumes next run)' : ''}; ${s.identify.verified} already verified`)
  if (s.coversReview) lines.push(`cover picks: ${s.coversReview.applied} applied, ${s.coversReview.stillPending} still pending`)
  if (s.covers) lines.push(`covers:      ${s.covers.proposed} lists proposed, ${s.covers.awaitingReview} awaiting your pick, ${s.covers.decided} decided${s.covers.stoppedEarly ? ' (rate-limited, resumes next run)' : ''}`)
  if (s.media) lines.push(`media:       ${s.media.imported} imported, ${s.media.noImage} no image, ${s.media.rejected} rejected, ${s.media.failed} failed, ${s.media.remaining} remaining (${s.media.rounds} rounds); ${s.media.withImage} with image`)
  if (s.derived) lines.push(`rankings:    ${s.derived.rankingsRebuild}`)
  if (s.audit) lines.push(`audit:       ${s.audit}`)
  return lines.join('\n')
}

function fail(message: string): never {
  console.error(`\n✗ ${message}\n${report()}`)
  process.exit(1)
}

/** Runs a stage, streaming its output, and returns its exit code and the JSON after its marker line. */
function stage(title: string, cmd: string, cmdArgs: string[], marker: string, env: NodeJS.ProcessEnv = process.env) {
  console.log(`\n→ ${title}`)
  return new Promise<{ code: number; result: any }>((done) => {
    const child = spawn(cmd, cmdArgs, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (chunk) => { out += chunk; process.stdout.write(`  ${String(chunk).replace(/\n(?=.)/g, '\n  ')}`) })
    child.stderr.on('data', (chunk) => process.stderr.write(`  ${String(chunk).replace(/\n(?=.)/g, '\n  ')}`))
    child.on('close', (code) => {
      const line = marker ? out.split('\n').reverse().find((l) => l.startsWith(`${marker} `)) : undefined
      done({ code: code ?? 1, result: line ? JSON.parse(line.slice(marker.length + 1)) : undefined })
    })
  })
}

const local = (script: string, extra: string[] = []) => ['--filter', 'server', 'exec', 'tsx', `src/scripts/${script}`, ...extra]
const remote = (script: string) => ['ssh', '--service', 'server', '--environment', envName, '--', 'sh', '-c', `cd /app/apps/server && ./node_modules/.bin/tsx src/scripts/${script}`]

function preflight() {
  console.log(`→ preflight (${envName})`)
  const dirty = sh('git', ['status', '--porcelain', '--', ...CODE_PATHS, ...DATA_PATHS]).trim()
  if (dirty) fail(`Commit these first — a publish must be reproducible from git:\n${dirty}`)

  const deployments = JSON.parse(sh('railway', ['deployment', 'list', '--service', 'server', '--environment', envName, '--json'])) as any[]
  const deployed = deployments.find((d) => d.status === 'SUCCESS')?.meta?.commitHash as string | undefined
  if (!deployed) fail(`No successful server deployment found in ${envName}`)
  try {
    sh('git', ['diff', '--quiet', deployed, 'HEAD', '--', ...CODE_PATHS])
  } catch {
    fail(`Local code differs from what ${envName} runs (${deployed.slice(0, 7)}). Push and wait for the deploy, or check out that commit.`)
  }
  summary.deployedCommit = deployed.slice(0, 7)

  const url = sh('railway', ['variables', '--service', 'MySQL', '--environment', envName, '--kv'])
    .split('\n').find((l) => l.startsWith('MYSQL_PUBLIC_URL='))?.slice('MYSQL_PUBLIC_URL='.length)
  if (!url) fail(`MySQL in ${envName} has no MYSQL_PUBLIC_URL (enable public networking)`)
  // The environment's schema is `db push`-managed, so drift is silent: missing
  // Rankings columns once went unnoticed for days. Refuse to publish onto it.
  try {
    execFileSync('pnpm', ['--filter', '@project/db', 'exec', 'prisma', 'migrate', 'diff', '--from-url', url, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, DATABASE_URL: url } })
  } catch (error: any) {
    if (error.status === 2) fail(`${envName} database schema differs from packages/db/prisma/schema.prisma. Inspect: pnpm --filter @project/db exec prisma migrate diff --from-url "$(railway variables --service MySQL --environment ${envName} --kv | sed -n 's/^MYSQL_PUBLIC_URL=//p')" --to-schema-datamodel prisma/schema.prisma --script`)
    fail(`Could not compare the ${envName} schema: ${String(error.stderr ?? error.message).trim().split('\n').pop()}`)
  }
  summary.schema = 'matches'
  console.log(`  code matches deployed ${deployed.slice(0, 7)}; schema matches; database ${new URL(url).host}`)
  return { ...process.env, DATABASE_URL: url, REVIEW_ENV: envName }
}

async function main() {
  const env = preflight()

  const validate = await stage('catalog:validate', 'pnpm', local('catalog-publish.ts', ['--dry-run']), 'CATALOG', env)
  summary.validate = validate.result
  if (validate.code) fail('Catalog validation failed; fix the files above')
  if (flag('--dry-run')) return console.log(`\n✓ dry run\n${report()}`)

  const publish = await stage('catalog:publish', 'pnpm', local('catalog-publish.ts'), 'CATALOG', env)
  summary.publish = publish.result
  if (publish.code) fail('Catalog publish failed')

  if (!flag('--skip-media')) {
    if (flag('--apply-review')) {
      const applied = await stage('media:identify --apply-review', 'pnpm', local('media-identify.ts', ['--apply-review']), 'IDENTIFY_REVIEW', env)
      summary.review = applied.result
      if (applied.code) fail('Could not apply identity review decisions')
    }
    if (flag('--apply-review')) {
      const covers = await stage('covers:propose --apply-review', 'pnpm', local('covers-propose.ts', ['--apply-review']), 'COVERS_REVIEW', env)
      summary.coversReview = covers.result
      if (covers.code) fail('Could not apply cover decisions (see above)')
    }
    const identify = await stage('media:identify', 'pnpm', local('media-identify.ts'), 'IDENTIFY', env)
    summary.identify = identify.result
    // A rate-limited identify run saves its progress; sync what is verified and resume next time.
    if (identify.code && !identify.result?.stoppedEarly) fail('Identity resolution failed')
    if (identify.result?.stoppedEarly) console.log('  (identify stopped early on Wikidata rate limits — continuing; re-run later to resume)')

    const proposed = await stage('covers:propose', 'pnpm', local('covers-propose.ts'), 'COVERS', env)
    summary.covers = proposed.result
    if (proposed.code && !proposed.result?.stoppedEarly) fail('Cover proposal failed')

    const media = { rounds: 0, imported: 0, noImage: 0, rejected: 0, failed: 0, remaining: 0, withImage: 0 }
    summary.media = media
    for (let round = 1; round <= MAX_SYNC_ROUNDS; round++) {
      const sync = await stage(`media:sync (round ${round}, in container)`, 'railway', remote('media-sync.ts'), 'MEDIA_SYNC')
      const r = sync.result ?? {}
      media.rounds = round
      for (const k of ['imported', 'noImage', 'rejected', 'failed'] as const) media[k] += r[k] ?? 0
      media.remaining = r.remaining ?? media.remaining
      media.withImage = (r.withImage ?? 0) + (r.imported ?? 0)
      if (sync.code) fail('Media sync hit unexpected failures (see above); re-run later to resume')
      if (!sync.result?.remaining || !sync.result?.processed) break
    }
  }

  const derived = await stage('derived:enqueue', 'pnpm', local('derived-enqueue.ts'), 'DERIVED', env)
  summary.derived = derived.result
  if (derived.code) fail('Could not queue the rankings rebuild')

  const audit = await stage('audit (in container)', 'railway', remote('audit-media.ts'), '')
  summary.audit = audit.code ? 'FAIL' : 'PASS'
  if (audit.code) fail('Media audit failed — see findings above (repair-taxonomy-media.ts fixes them)')

  const pending = (summary.identify as any)?.reviewFile
  const sheet = (summary.covers as any)?.contactSheet
  console.log(`\n✓ ${envName} catalog published\n${report()}`)
  if (pending) console.log(`\nIdentities awaiting your review: ${pending}`)
  if (sheet) console.log(`\nCover candidates to pick from: ${sheet}`)
  if (pending || sheet) console.log('Decide each entry, then run: pnpm prod:publish-catalog --apply-review')
}

main().catch((error) => fail(error?.message ?? String(error)))
