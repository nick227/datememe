const items = [
  // The rest of the items
  { type: 'video-game', name: 'The Witcher 3: Wild Hunt', q: 'The Witcher 3' },
  { type: 'video-game', name: 'Red Dead Redemption 2' },
  { type: 'video-game', name: 'Minecraft' },
  { type: 'video-game', name: 'Grand Theft Auto V' },
  { type: 'author', name: 'Jane Austen' },
  { type: 'author', name: 'Charles Dickens' },
  { type: 'author', name: 'Mark Twain' },
  { type: 'author', name: 'Fyodor Dostoevsky' },
  { type: 'author', name: 'Leo Tolstoy' },
  { type: 'author', name: 'Stephen King' },
  { type: 'author', name: 'J.K. Rowling' },
  { type: 'author', name: 'George R.R. Martin' },
  { type: 'author', name: 'Agatha Christie' },
  { type: 'author', name: 'Toni Morrison' },
  { type: 'tv-show', name: 'The Bear' },
  { type: 'tv-show', name: 'Succession' },
  { type: 'tv-show', name: 'The White Lotus', q: 'White Lotus' },
  { type: 'tv-show', name: 'Severance' },
  { type: 'tv-show', name: 'The Sopranos' },
  { type: 'tv-show', name: 'Breaking Bad' },
  { type: 'tv-show', name: 'The Wire' },
  { type: 'tv-show', name: 'Game of Thrones' },
  { type: 'tv-show', name: 'Stranger Things' },
  { type: 'tv-show', name: 'The Office' },
  { type: 'tv-show', name: 'Seinfeld' },
  { type: 'tv-show', name: 'Friends' },
  { type: 'tv-show', name: 'Mad Men' },
  { type: 'tv-show', name: 'Better Call Saul' },
  { type: 'tv-show', name: 'Fargo' },
  { type: 'movie', name: 'The Exorcist' },
  { type: 'movie', name: 'Halloween' },
  { type: 'movie', name: 'Scream' },
  { type: 'movie', name: 'A Nightmare on Elm Street' },
  { type: 'movie', name: 'Alien' },
  { type: 'movie', name: 'The Thing' },
  { type: 'band', name: 'Oasis' },
  { type: 'band', name: 'Pearl Jam' },
  { type: 'band', name: 'The Smashing Pumpkins' },
  { type: 'band', name: 'Blur' },
  { type: 'band', name: 'Weezer' },
  { type: 'band', name: 'No Doubt' },
  { type: 'band', name: 'Green Day' },
  { type: 'band', name: 'R.E.M.' },
];

async function main() {
  const results = [];
  for (const item of items) {
    const searchName = item.q || item.name;
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
        const match = data.search.find((s: any) => 
          (item.type === 'video-game' && s.description?.toLowerCase().includes('video game')) ||
          (item.type === 'author' && (s.description?.toLowerCase().includes('writer') || s.description?.toLowerCase().includes('author') || s.description?.toLowerCase().includes('novelist'))) ||
          (item.type === 'tv-show' && s.description?.toLowerCase().includes('television')) ||
          (item.type === 'movie' && s.description?.toLowerCase().includes('film')) ||
          (item.type === 'band' && (s.description?.toLowerCase().includes('band') || s.description?.toLowerCase().includes('group') || s.description?.toLowerCase().includes('musician')))
        ) || data.search[0];

        if (match) {
          results.push(`  { type: '${item.type}', name: '${item.name}', qid: '${match.id}' }, // ${match.description || 'No description'}`);
        } else {
          results.push(`  // Not found: ${item.name}`);
        }
        success = true;
      } catch (e: any) {
        retries--;
        if (retries === 0) results.push(`  // Error: ${item.name} (${e.message})`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    await new Promise(r => setTimeout(r, 500)); 
  }

  console.log(results.join('\n'));
}

main();
