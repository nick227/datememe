import { ListImporterService, ListSeedInput } from '../services/ListImporterService'

const listsToImport: ListSeedInput[] = [
  {
    schemaVersion: 1,
    groupSlug: 'sports',
    entityTypeSlug: 'athlete',
    title: 'Top Athletes of All Time',
    prompt: 'Who are the greatest athletes of all time?',
    axes: ['sports', 'legacy', 'performance'],
    values: ['Michael Jordan', 'Muhammad Ali', 'Serena Williams', 'Tom Brady', 'Lionel Messi', 'Usain Bolt', 'Pele', 'LeBron James', 'Tiger Woods', 'Wayne Gretzky'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'sports',
    entityTypeSlug: 'sports-team',
    title: 'Favorite Sports Franchises',
    prompt: 'Which sports teams do you passionately follow or respect?',
    axes: ['sports', 'fandom', 'legacy'],
    values: ['New York Yankees', 'Los Angeles Lakers', 'Dallas Cowboys', 'Real Madrid', 'Manchester United', 'New England Patriots', 'Chicago Bulls', 'Golden State Warriors', 'FC Barcelona', 'Toronto Maple Leafs'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'sports',
    entityTypeSlug: 'extreme-sport',
    title: 'Favorite Extreme Sports',
    prompt: 'What are the most thrilling extreme sports?',
    axes: ['sports', 'outdoors', 'adrenaline'],
    values: ['Snowboarding', 'Surfing', 'Skateboarding', 'BMX', 'Skydiving', 'Rock Climbing', 'Base Jumping', 'Motocross', 'White Water Rafting', 'Parkour'],
    isAbstract: true
  },
  {
    schemaVersion: 1,
    groupSlug: 'craft', // Craft is mapped to "Culture" on the front page
    entityTypeSlug: 'us-president',
    title: 'Most Impactful US Presidents',
    prompt: 'Which US Presidents had the greatest historical impact?',
    axes: ['politics', 'history', 'leadership'],
    values: ['Abraham Lincoln', 'George Washington', 'Franklin D. Roosevelt', 'Theodore Roosevelt', 'Thomas Jefferson', 'Harry S. Truman', 'Dwight D. Eisenhower', 'John F. Kennedy', 'Ronald Reagan', 'Barack Obama'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'craft',
    entityTypeSlug: 'historical-figure',
    title: 'Most Influential Historical Figures',
    prompt: 'Who shaped the course of human history the most?',
    axes: ['politics', 'history', 'culture'],
    values: ['Martin Luther King Jr.', 'Mahatma Gandhi', 'Nelson Mandela', 'Winston Churchill', 'Albert Einstein', 'Julius Caesar', 'Alexander the Great', 'Leonardo da Vinci', 'Marie Curie', 'Napoleon Bonaparte'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'creators',
    entityTypeSlug: 'commentator',
    title: 'Top Political Commentators',
    prompt: 'Which political commentators or journalists do you tune into?',
    axes: ['politics', 'media', 'creators'],
    values: ['Jon Stewart', 'John Oliver', 'Tucker Carlson', 'Rachel Maddow', 'Ben Shapiro', 'Anderson Cooper', 'Hasan Piker', 'Ezra Klein', 'Megyn Kelly', 'Bill Maher'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'podcasts',
    entityTypeSlug: 'podcast',
    title: 'Favorite Political Podcasts',
    prompt: 'What are the best podcasts for politics and current events?',
    axes: ['politics', 'media', 'podcasts'],
    values: ['The Daily', 'Pod Save America', 'The Joe Rogan Experience', 'Up First', 'The Ben Shapiro Show', 'Breaking Points', 'FiveThirtyEight Politics', 'Stay Tuned with Preet', 'The Ezra Klein Show', 'Chap Trap House'],
    isAbstract: true
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
