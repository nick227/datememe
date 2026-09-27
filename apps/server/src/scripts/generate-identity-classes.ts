import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { sourceFingerprint } from '../lib/identityClasses'

// Expands catalog/identity-classes.json with every P279* subclass so items
// typed with a genre ("action role-playing game", "teen sitcom") still match.
// Run after editing identity-classes.json:
//   pnpm --filter server exec tsx src/scripts/generate-identity-classes.ts
// media:identify refuses to run on a generated file older than its source.
//
// Not expanded: human and literary work. Real people are always P31 "human"
// itself — its ~1,900 subclasses are roles like "First Lady of the Gambia" —
// and literary work's ~5,600 pull in comics, songs and jokes (War and Peace ->
// a Star Trek comic would pass as a "book").
const NO_EXPAND = new Set(['Q5', 'Q7725634'])

// Subclasses that describe something *about* a work rather than a work: an
// item typed "board game franchise" is the franchise, not the game (the real
// Carcassonne is typed "tabletop game", so the franchise was the only match
// and got auto-accepted). A word counts only when the base class lacks it —
// "series" is meta for film ("film series") but not for "television series".
// Remakes, adaptations and anthologies are works themselves, so they stay.
// Subclasses without an English label are excluded: no one can judge them.
const META_WORDS = /\b(franchise|series|version|edition|port|expansion|downloadable content|dlc|add-on|mod|demo|project|segment|trailer|compilation|collection|bundle|meme|bomb|flop|award|list|index|character|universe|soundtrack|merchandise)\b/gi
const isMetaClass = (subLabel: string, baseLabel: string) =>
  [...subLabel.matchAll(META_WORDS)].some(([word]) => !new RegExp(`\\b${word}\\b`, 'i').test(baseLabel))

const ROOT = resolve(__dirname, '../../../..')
const IN_FILE = resolve(ROOT, 'catalog/identity-classes.json')
const OUT_FILE = resolve(ROOT, 'catalog/identity-classes.generated.json')
const USER_AGENT = 'Datememe/1.0 (catalog identity resolver offline subclass expansion)'

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  const source = readFileSync(IN_FILE, 'utf8')
  const allowed = JSON.parse(source)
  const comment = allowed.$comment
  delete allowed.$comment

  const expanded: Record<string, Record<string, string>> = {}
  
  for (const [typeSlug, classes] of Object.entries(allowed)) {
    expanded[typeSlug] = {}
    
    for (const [qid, label] of Object.entries(classes as Record<string, string>)) {
      expanded[typeSlug]![qid] = label
      if (NO_EXPAND.has(qid)) continue

      console.log(`Expanding ${typeSlug}: ${qid} (${label})`)
      
      const query = `SELECT ?subClass ?label WHERE { ?subClass wdt:P279* wd:${qid} . OPTIONAL { ?subClass rdfs:label ?label . FILTER(lang(?label) = 'en') } }`
      
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch('https://query.wikidata.org/sparql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/sparql-results+json',
              'User-Agent': USER_AGENT
            },
            body: new URLSearchParams({ query })
          })
          
          if (!response.ok) {
            throw new Error(`Wikidata SPARQL returned ${response.status}`)
          }
          
          const data = await response.json()
          const results = data.results.bindings
          
          let count = 0, skipped = 0
          for (const r of results) {
            const subQid = r.subClass.value.split('/').pop()
            const subLabel: string | undefined = r.label?.value
            if (!subQid || !/^Q\d+$/.test(subQid) || expanded[typeSlug]![subQid]) continue
            if (!subLabel || isMetaClass(subLabel, label)) { skipped++; continue }
            expanded[typeSlug]![subQid] = `${subLabel} (subclass of ${label})`
            count++
          }
          console.log(`  -> Added ${count} subclasses, skipped ${skipped} meta/unlabeled`)
          break // success
        } catch (err: any) {
          console.error(`  -> Attempt ${attempt + 1} failed for ${qid}:`, err.message)
          if (attempt === 2) throw err
          await sleep(5000)
        }
      }
      
      await sleep(2000)
    }
  }

  const outData = {
    $comment: `[GENERATED FILE - DO NOT EDIT DIRECTLY] Expanded from identity-classes.json using P279* (subclass of), except ${[...NO_EXPAND].join(', ')}. ${comment}`,
    $sourceSha256: sourceFingerprint(source),
    ...expanded
  }
  
  writeFileSync(OUT_FILE, JSON.stringify(outData, null, 2) + '\n')
  console.log(`Wrote expanded classes to ${OUT_FILE}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
