import { ListImporterService, ListSeedInput } from '../services/ListImporterService'

const listsToImport: ListSeedInput[] = [
  {
    schemaVersion: 1,
    groupSlug: 'music',
    entityTypeSlug: 'band',
    title: 'Top Rock Bands',
    prompt: 'Who are the greatest rock bands of all time?',
    axes: ['music', 'rock', 'taste'],
    values: ['The Beatles', 'Led Zeppelin', 'Pink Floyd', 'The Rolling Stones', 'Queen', 'AC/DC', 'Nirvana', 'The Who', 'Metallica', 'Guns N\' Roses'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'music',
    entityTypeSlug: 'band',
    title: 'Favorite Pop Artists',
    prompt: 'Rank your all-time favorite pop artists.',
    axes: ['music', 'pop', 'energy'],
    values: ['Michael Jackson', 'Madonna', 'Taylor Swift', 'Lady Gaga', 'Beyoncé', 'Justin Bieber', 'Ariana Grande', 'Katy Perry', 'Bruno Mars', 'Ed Sheeran'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'music',
    entityTypeSlug: 'band',
    title: 'Top Hip Hop Artists',
    prompt: 'Who are your top hip hop artists or rappers?',
    axes: ['music', 'hip-hop', 'culture'],
    values: ['Tupac', 'The Notorious B.I.G.', 'Jay-Z', 'Nas', 'Eminem', 'Kendrick Lamar', 'Drake', 'Kanye West', 'Snoop Dogg', 'J. Cole'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'music',
    entityTypeSlug: 'festival',
    title: 'Favorite Music Festivals',
    prompt: 'What are your dream music festivals to attend?',
    axes: ['music', 'live-events', 'social'],
    values: ['Coachella', 'Glastonbury', 'Lollapalooza', 'Tomorrowland', 'Bonnaroo', 'Austin City Limits', 'Ultra Music Festival', 'EDC', 'Reading and Leeds', 'Primavera Sound'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'movie',
    title: 'Top Movie Soundtracks',
    prompt: 'Which movies have the greatest soundtracks?',
    axes: ['film-tv', 'music', 'entertainment'],
    values: ['Guardians of the Galaxy', 'Pulp Fiction', 'The Lord of the Rings: The Fellowship of the Ring', 'Star Wars: Episode IV - A New Hope', 'Interstellar', 'The Lion King', 'Inception', 'Titanic', 'Saturday Night Fever', 'The Bodyguard'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'social-media-creator',
    title: 'Favorite YouTubers',
    prompt: 'Who are your favorite YouTube creators?',
    axes: ['entertainment', 'internet-culture', 'comedy'],
    values: ['MrBeast', 'PewDiePie', 'Markiplier', 'Jacksepticeye', 'Marques Brownlee', 'Dude Perfect', 'Logan Paul', 'Emma Chamberlain', 'Casey Neistat', 'Ryan Higa'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'music',
    entityTypeSlug: 'music-genre',
    title: 'Top Music Genres',
    prompt: 'Rank your most listened-to music genres.',
    axes: ['music', 'lifestyle', 'taste'],
    values: ['Rock', 'Pop', 'Hip Hop', 'R&B', 'Electronic', 'Country', 'Jazz', 'Classical', 'Heavy Metal', 'Reggae'],
    isAbstract: true
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'streaming-service',
    title: 'Top Streaming Services',
    prompt: 'Which streaming platforms are your favorites?',
    axes: ['entertainment', 'film-tv', 'music'],
    values: ['Netflix', 'Hulu', 'HBO Max', 'Disney+', 'Amazon Prime Video', 'Spotify', 'Apple Music', 'YouTube Premium', 'Crunchyroll', 'Twitch'],
    isAbstract: true
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'composer',
    title: 'Favorite Film Composers',
    prompt: 'Who are the greatest cinematic composers?',
    axes: ['film-tv', 'music', 'art'],
    values: ['Hans Zimmer', 'John Williams', 'Ennio Morricone', 'Howard Shore', 'Danny Elfman', 'Alan Silvestri', 'Trent Reznor', 'Thomas Newman', 'Alexandre Desplat', 'Michael Giacchino'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'music',
    entityTypeSlug: 'music-video',
    title: 'Iconic Music Videos',
    prompt: 'What are the most iconic music videos ever made?',
    axes: ['music', 'film-tv', 'pop-culture'],
    values: ['Thriller', 'Single Ladies', 'Bohemian Rhapsody', 'Take On Me', 'Smells Like Teen Spirit', 'Hotline Bling', 'This Is America', 'Wrecking Ball', 'Weapon of Choice', 'Sabotage'],
    isAbstract: false
  }
]

async function run() {
  const importer = new ListImporterService()
  let i = 0
  for (const list of listsToImport) {
    console.log(`Importing [${i + 1}/${listsToImport.length}] ${list.title}...`)
    const report = await importer.importList(list)
    if (report.status === 'ERROR') {
      console.error(`❌ Failed to import ${list.title}:`, report.errors)
    } else {
      console.log(`✅ Success: ${report.entitiesCreated.length} created, ${report.entitiesReused.length} reused.`)
      if (report.entitiesReused.length > 0) {
        console.log(`   Reused: ${report.entitiesReused.join(', ')}`)
      }
    }
    i++
  }
}

run().catch(console.error).finally(() => process.exit(0))
