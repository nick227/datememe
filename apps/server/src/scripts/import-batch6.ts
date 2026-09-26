import { ListImporterService, ListSeedInput } from '../services/ListImporterService'

const listsToImport: ListSeedInput[] = [
  {
    schemaVersion: 1,
    groupSlug: 'music',
    entityTypeSlug: 'band',
    title: 'Favorite Indie Bands',
    prompt: 'Who are your favorite indie or alternative bands?',
    axes: ['music', 'alternative', 'taste'],
    values: ['Arctic Monkeys', 'The Strokes', 'Arcade Fire', 'Tame Impala', 'Vampire Weekend', 'The Killers', 'Florence + The Machine', 'MGMT', 'The Black Keys', 'Radiohead'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'music',
    entityTypeSlug: 'band',
    title: 'Top R&B Artists',
    prompt: 'Who are the greatest R&B artists of all time?',
    axes: ['music', 'rb', 'culture'],
    values: ['The Weeknd', 'Frank Ocean', 'SZA', 'Usher', 'Alicia Keys', 'John Legend', 'Chris Brown', 'Mary J. Blige', 'Lauryn Hill', 'Boyz II Men'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'music',
    entityTypeSlug: 'musician',
    title: 'Top Guitarists',
    prompt: 'Who are the greatest guitarists in music history?',
    axes: ['music', 'instrumental', 'rock'],
    values: ['Jimi Hendrix', 'Eric Clapton', 'Jimmy Page', 'Eddie Van Halen', 'Stevie Ray Vaughan', 'B.B. King', 'Chuck Berry', 'Keith Richards', 'Slash', 'John Mayer'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'music',
    entityTypeSlug: 'song',
    title: 'Favorite Classic Rock Songs',
    prompt: 'What are the most iconic classic rock anthems?',
    axes: ['music', 'rock', 'nostalgia'],
    values: ['Stairway to Heaven', 'Bohemian Rhapsody', 'Hotel California', 'Smells Like Teen Spirit', 'Sweet Child O\' Mine', 'Free Bird', 'Back in Black', 'Comfortably Numb', 'Dream On', 'Born to Run'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'movie',
    title: 'Favorite Animated Movies',
    prompt: 'What are your favorite animated feature films?',
    axes: ['film-tv', 'animation', 'comfort'],
    values: ['Spider-Man: Into the Spider-Verse', 'Toy Story', 'Finding Nemo', 'Shrek', 'The Lion King', 'Up', 'WALL-E', 'Inside Out', 'The Incredibles', 'Aladdin'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'movie',
    title: 'Favorite Comedy Movies',
    prompt: 'Which comedy movies always make you laugh?',
    axes: ['film-tv', 'comedy', 'entertainment'],
    values: ['Superbad', 'Step Brothers', 'The Hangover', 'Anchorman: The Legend of Ron Burgundy', 'Bridesmaids', 'Dumb and Dumber', 'Mean Girls', 'Shaun of the Dead', 'Monty Python and the Holy Grail', 'Tropic Thunder'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'tv-show',
    title: 'Favorite Sci-Fi Shows',
    prompt: 'Rank your favorite science fiction television series.',
    axes: ['film-tv', 'sci-fi', 'nerd'],
    values: ['Doctor Who', 'Black Mirror', 'Stranger Things', 'The X-Files', 'The Mandalorian', 'Firefly', 'Star Trek: The Next Generation', 'Westworld', 'The Expanse', 'Severance'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'tv-personality',
    title: 'Favorite Talk Show Hosts',
    prompt: 'Who are your favorite late night or daytime talk show hosts?',
    axes: ['entertainment', 'comedy', 'pop-culture'],
    values: ['Conan O\'Brien', 'Jon Stewart', 'Stephen Colbert', 'Jimmy Fallon', 'Jimmy Kimmel', 'David Letterman', 'Oprah Winfrey', 'Ellen DeGeneres', 'Craig Ferguson', 'Seth Meyers'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'movie',
    title: 'Top Documentaries',
    prompt: 'What are the most compelling documentaries you\'ve seen?',
    axes: ['film-tv', 'educational', 'culture'],
    values: ['Planet Earth', 'Jiro Dreams of Sushi', 'Free Solo', 'The Last Dance', 'My Octopus Teacher', 'Blackfish', 'Icarus', '13th', 'Man on Wire', 'Won\'t You Be My Neighbor?'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'movie',
    title: 'Favorite Action Movies',
    prompt: 'Rank the greatest action movies of all time.',
    axes: ['film-tv', 'action', 'energy'],
    values: ['Die Hard', 'The Matrix', 'Terminator 2: Judgment Day', 'Mad Max: Fury Road', 'John Wick', 'The Dark Knight', 'Gladiator', 'Raiders of the Lost Ark', 'Mission: Impossible - Fallout', 'Aliens'],
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
