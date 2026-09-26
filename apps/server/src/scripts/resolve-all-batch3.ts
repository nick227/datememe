import fs from 'fs';

const missing = [
  { name: 'Los Angeles Lakers', type: 'sports-team' },
  { name: 'Golden State Warriors', type: 'sports-team' },
  { name: 'Real Madrid', type: 'sports-team' },
  { name: 'Manchester United', type: 'sports-team' },
  { name: 'New York Yankees', type: 'sports-team' },
  { name: 'Boston Red Sox', type: 'sports-team' },
  { name: 'Dallas Cowboys', type: 'sports-team' },
  { name: 'New England Patriots', type: 'sports-team' },
  { name: 'Green Bay Packers', type: 'sports-team' },
  { name: 'Los Angeles Dodgers', type: 'sports-team' },

  { name: 'LeBron James', type: 'athlete' },
  { name: 'Michael Jordan', type: 'athlete' },
  { name: 'Kobe Bryant', type: 'athlete' },
  { name: 'Stephen Curry', type: 'athlete' },
  { name: 'Kevin Durant', type: 'athlete' },
  { name: 'Giannis Antetokounmpo', type: 'athlete' },
  { name: 'Nikola Jokić', type: 'athlete' },
  { name: 'Luka Dončić', type: 'athlete' },
  { name: 'Lionel Messi', type: 'athlete' },
  { name: 'Cristiano Ronaldo', type: 'athlete' },
  { name: 'Neymar Jr', type: 'athlete' },
  { name: 'Kylian Mbappé', type: 'athlete' },
  { name: 'Erling Haaland', type: 'athlete' },
  { name: 'Diego Maradona', type: 'athlete' },
  { name: 'Pelé', type: 'athlete' },

  { name: 'Christopher Nolan', type: 'movie-director' },
  { name: 'Steven Spielberg', type: 'movie-director' },
  { name: 'Quentin Tarantino', type: 'movie-director' },
  { name: 'Martin Scorsese', type: 'movie-director' },
  { name: 'Greta Gerwig', type: 'movie-director' },
  { name: 'Denis Villeneuve', type: 'movie-director' },
  { name: 'Stanley Kubrick', type: 'movie-director' },
  { name: 'Alfred Hitchcock', type: 'movie-director' },
  { name: 'Francis Ford Coppola', type: 'movie-director' },
  { name: 'Wes Anderson', type: 'movie-director' },
  { name: 'Bong Joon Ho', type: 'movie-director' },
  { name: 'Ridley Scott', type: 'movie-director' },
  
  { name: 'Yellowstone', type: 'national-park' },
  { name: 'Yosemite', type: 'national-park' },
  { name: 'Grand Canyon', type: 'national-park' },
  { name: 'Zion', type: 'national-park' },
  { name: 'Glacier', type: 'national-park' },
  { name: 'Rocky Mountain', type: 'national-park' },
  { name: 'Acadia', type: 'national-park' },
  { name: 'Arches', type: 'national-park' },
  { name: 'Olympic', type: 'national-park' },
  { name: 'Great Smoky Mountains', type: 'national-park' },
  { name: 'Joshua Tree', type: 'national-park' },
  { name: 'Denali', type: 'national-park' },
  
  // Games
  { name: 'Catan', type: 'board-game' },
  { name: 'Ticket to Ride', type: 'board-game' },
  { name: 'Monopoly', type: 'board-game' },
  { name: 'Dungeons & Dragons', type: 'board-game' },
  { name: 'Chess', type: 'board-game' },
  { name: 'Scrabble', type: 'board-game' },
  { name: 'Carcassonne', type: 'board-game' },
  { name: 'Pandemic', type: 'board-game' },
  { name: 'Wingspan', type: 'board-game' },
  { name: 'Risk', type: 'board-game' },

  { name: "Marvel's Spider-Man 2", type: 'video-game' },
  { name: 'God of War Ragnarök', type: 'video-game' },
  { name: 'Returnal', type: 'video-game' },
  { name: 'Ghost of Tsushima', type: 'video-game' },
  { name: "Demon's Souls", type: 'video-game' },
  { name: 'Elden Ring', type: 'video-game' },
  { name: 'The Last of Us Part I', type: 'video-game' },
  { name: 'Horizon Forbidden West', type: 'video-game' },
  { name: 'Cyberpunk 2077', type: 'video-game' },
  { name: 'Final Fantasy XVI', type: 'video-game' },
  { name: 'Red Dead Redemption 2', type: 'video-game' },
  { name: 'Grand Theft Auto V', type: 'video-game' },
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
