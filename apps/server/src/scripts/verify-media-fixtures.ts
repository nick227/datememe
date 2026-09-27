import { fixtures } from './taxonomyMediaFixtures'

// Run after editing taxonomyMediaFixtures.ts (anywhere; no database needed):
//   pnpm --filter server verify:media-fixtures
// Prints every fixture next to what Wikidata says its QID is, so a human can
// confirm identity by description, not name — a matching name proved nothing
// for "Catan" (Catania, a city) or "Go" (Goiás, a state). Exits 1 if any QID
// no longer exists or redirects elsewhere.
const USER_AGENT = 'Datememe/1.0 (fixture verification)'

async function main() {
  const ids = [...new Set(fixtures.map((f) => f.qid as string))]
  const info = new Map<string, { label?: string; description?: string; missing?: boolean; redirectedTo?: string }>()
  for (let i = 0; i < ids.length; i += 50) {
    const params = new URLSearchParams({ action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'), props: 'labels|descriptions', languages: 'en|mul', languagefallback: '1', format: 'json' })
    const response = await fetch(`https://www.wikidata.org/w/api.php?${params}`, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`Wikidata returned ${response.status}; wait and retry`)
    const data = await response.json() as any
    for (const [id, e] of Object.entries<any>(data.entities)) {
      info.set(id, e.missing !== undefined ? { missing: true } : {
        label: (e.labels?.en ?? e.labels?.mul)?.value,
        description: e.descriptions?.en?.value,
        redirectedTo: e.id !== id ? e.id : undefined,
      })
    }
    await new Promise((resolve) => setTimeout(resolve, 3000)) // stay under Wikidata's rate limit
  }
  let broken = 0
  for (const f of fixtures) {
    const e = info.get(f.qid)
    const flag = !e || e.missing ? 'MISSING ' : e.redirectedTo ? `REDIRECT->${e.redirectedTo} ` : ''
    if (flag) broken++
    console.log(`${flag}${f.type} | ${f.name} | ${f.qid} | ${e?.label ?? '-'} — ${e?.description ?? '-'}`)
  }
  console.log(`\n${fixtures.length} fixtures, ${broken} missing/redirected. Read the descriptions: they are the identity check.`)
  if (broken) process.exitCode = 1
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
