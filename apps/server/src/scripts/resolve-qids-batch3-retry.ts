const items = [
  ...['Fahrenheit 451', 'Brave New World', 'The Left Hand of Darkness', 'Hyperion'].map(n => ({type: 'book', name: n})),
  ...['To Kill a Mockingbird', 'The Great Gatsby', 'Pride and Prejudice', 'The Catcher in the Rye', 'The Kite Runner'].map(n => ({type: 'book', name: n})),
  ...['Betrayal at House on the Hill', 'Secret Hitler', 'Codenames', 'Scythe', 'Terraforming Mars'].map(n => ({type: 'board-game', name: n})),
  ...['It\'s Always Sunny in Philadelphia', 'Scrubs', 'Community'].map(n => ({type: 'tv-show', name: n})),
  ...['Super Mario Odyssey', 'The Legend of Zelda: Breath of the Wild', 'Halo: Combat Evolved', 'Half-Life 2'].map(n => ({type: 'video-game', name: n})),
  ...['True Detective', 'Chernobyl', 'Peaky Blinders', 'The Last of Us', 'Black Mirror'].map(n => ({type: 'tv-show', name: n})),
];

async function main() {
  const results = [];
  for (const item of items) {
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
          results.push(`  { type: '${item.type}', name: '${item.name.replace(/'/g, "\\'")}', qid: '${match.id}' }, // ${match.description || 'No description'}`);
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
