import fs from 'fs';

const missing = [
  { name: 'Moby-Dick', type: 'book' },
  { name: 'War and Peace', type: 'book' },
  { name: 'The Odyssey', type: 'book' },
  { name: 'Jane Eyre', type: 'book' },
  { name: 'Do Androids Dream of Electric Sheep?', type: 'book' },
  { name: 'Solaris', type: 'book' },
  { name: 'The Time Machine', type: 'book' },
  { name: 'Twenty Thousand Leagues Under the Sea', type: 'book' },
  { name: 'Backgammon', type: 'board-game' },
  { name: 'Go', type: 'board-game' },
  { name: 'Cluedo', type: 'board-game' },
  { name: 'Mahjong', type: 'board-game' },
  { name: 'Dominoes', type: 'board-game' },
  { name: 'The X-Files', type: 'tv-show' },
  { name: 'Twin Peaks', type: 'tv-show' },
  { name: 'Doctor Who', type: 'tv-show' },
  { name: 'Star Trek: The Next Generation', type: 'tv-show' },
  { name: 'The Twilight Zone', type: 'tv-show' },
  { name: 'Buffy the Vampire Slayer', type: 'tv-show' },
  { name: 'Everglades', type: 'national-park' },
  { name: 'Death Valley', type: 'national-park' },
  { name: 'Sequoia', type: 'national-park' },
  { name: 'Mount Rainier', type: 'national-park' },
  { name: 'Pac-Man', type: 'video-game' },
  { name: 'Tetris', type: 'video-game' },
  { name: 'Doom', type: 'video-game' },
  { name: 'Pong', type: 'video-game' },
  { name: 'Space Invaders', type: 'video-game' },
  { name: 'The Legend of Zelda: Ocarina of Time', type: 'video-game' },
  { name: 'Super Mario Bros.', type: 'video-game' },
  { name: 'Street Fighter II', type: 'video-game' },
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
