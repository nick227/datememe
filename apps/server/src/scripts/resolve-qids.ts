const items = [
  // Video Games
  { type: 'video-game', name: "Marvel's Spider-Man 2" },
  { type: 'video-game', name: 'God of War Ragnarök' },
  { type: 'video-game', name: 'Returnal' },
  { type: 'video-game', name: 'Ghost of Tsushima' },
  { type: 'video-game', name: "Demon's Souls" },
  { type: 'video-game', name: 'Elden Ring' },
  { type: 'video-game', name: 'The Last of Us Part I' },
  { type: 'video-game', name: 'Horizon Forbidden West' },
  { type: 'video-game', name: 'Cyberpunk 2077' },
  { type: 'video-game', name: 'Final Fantasy XVI' },
  { type: 'video-game', name: 'The Witcher 3: Wild Hunt' },
  { type: 'video-game', name: 'Red Dead Redemption 2' },
  { type: 'video-game', name: 'Minecraft' },
  { type: 'video-game', name: 'Grand Theft Auto V' },
  // Authors
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
  // TV Shows
  { type: 'tv-show', name: 'The Bear' },
  { type: 'tv-show', name: 'Succession' },
  { type: 'tv-show', name: 'The White Lotus', q: 'White Lotus' }, // seed uses White Lotus
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
  // Horror Movies
  { type: 'movie', name: 'The Exorcist' },
  { type: 'movie', name: 'Halloween' },
  { type: 'movie', name: 'Scream' },
  { type: 'movie', name: 'A Nightmare on Elm Street' },
  { type: 'movie', name: 'Alien' },
  { type: 'movie', name: 'The Thing' },
  // Bands
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
    try {
      const res = await fetch(url);
      const data = await res.json();
      const match = data.search.find((s: any) => 
        (item.type === 'video-game' && s.description?.toLowerCase().includes('video game')) ||
        (item.type === 'author' && s.description?.toLowerCase().includes('writer') || s.description?.toLowerCase().includes('author') || s.description?.toLowerCase().includes('novelist')) ||
        (item.type === 'tv-show' && s.description?.toLowerCase().includes('television')) ||
        (item.type === 'movie' && s.description?.toLowerCase().includes('film')) ||
        (item.type === 'band' && (s.description?.toLowerCase().includes('band') || s.description?.toLowerCase().includes('group')))
      ) || data.search[0];

      if (match) {
        results.push(`  { type: '${item.type}', name: '${item.q || item.name}', qid: '${match.id}' }, // ${match.description || 'No description'}`);
      } else {
        results.push(`  // Not found: ${item.name}`);
      }
    } catch (e) {
      results.push(`  // Error: ${item.name}`);
    }
    await new Promise(r => setTimeout(r, 100)); // be nice to wikidata
  }

  console.log(results.join('\n'));
}

main();
