import fs from 'fs';

const missing = [
  { name: 'Toronto Maple Leafs', type: 'sports-team' },
  { name: 'Chicago Cubs', type: 'sports-team' },
  { name: 'David Fincher', type: 'movie-director' },
  { name: 'Sofia Coppola', type: 'movie-director' },
  { name: 'Guillermo del Toro', type: 'movie-director' },
  { name: 'Jordan Peele', type: 'movie-director' },
];

async function main() {
  const results: string[] = [];
  for (const item of missing) {
    const searchName = item.name;
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchName)}&language=en&format=json`;
    let success = false;
    let retries = 3;
    while (!success && retries > 0) {
      try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'datememe-seed-script/1.0 (test@example.com)' }
        });
        if (res.status === 429) {
            await new Promise(r => setTimeout(r, 2000));
            retries--;
            continue;
        }
        const data = await res.json();
        const match = data.search[0];

        if (match) {
          results.push(`  { type: '${item.type}', name: '${item.name.replace(/'/g, "\\'")}', qid: '${match.id}' },`);
        }
        success = true;
      } catch (e: any) {
        retries--;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    await new Promise(r => setTimeout(r, 500)); 
  }

  const path = '/home/administrator/web/datememe/apps/server/src/scripts/seed-taxonomy-media.ts';
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/\n\] as const/, '\n' + results.join('\n') + '\n] as const');
  fs.writeFileSync(path, content, 'utf8');
  console.log('Appended ' + results.length + ' QIDs to seed-taxonomy-media.ts');
}

main();
