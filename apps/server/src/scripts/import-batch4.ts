import { ListImporterService, ListSeedInput } from '../services/ListImporterService'

const listsToImport: ListSeedInput[] = [
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'movie',
    title: 'Top Sci-Fi Movies',
    prompt: 'What are the best sci-fi movies of all time?',
    axes: ['film-tv', 'entertainment', 'sci-fi'],
    values: ['Inception', 'The Matrix', 'Blade Runner', 'Star Wars: Episode IV - A New Hope', 'Alien', 'Interstellar', 'Back to the Future', 'Dune'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'food-drink',
    entityTypeSlug: 'food',
    title: 'Favorite Pizza Toppings',
    prompt: 'Rank your absolute favorite pizza toppings.',
    axes: ['food', 'comfort', 'taste'],
    values: ['Pepperoni', 'Mushrooms', 'Onions', 'Sausage', 'Bacon', 'Extra cheese', 'Black olives', 'Green peppers', 'Pineapple', 'Spinach'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'comedian',
    title: 'Top Comedians',
    prompt: 'Who are your favorite stand-up comedians?',
    axes: ['entertainment', 'comedy', 'taste'],
    values: ['Dave Chappelle', 'Bill Burr', 'John Mulaney', 'Ali Wong', 'Kevin Hart', 'Jerry Seinfeld', 'Robin Williams', 'Eddie Murphy', 'Chris Rock', 'Jim Carrey'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'lifestyle-hobbies',
    entityTypeSlug: 'video-game-console',
    title: 'Favorite Game Consoles',
    prompt: 'What are the greatest video game consoles ever?',
    axes: ['gaming', 'lifestyle', 'nerd'],
    values: ['PlayStation 2', 'Super Nintendo', 'Xbox 360', 'Nintendo 64', 'PlayStation 5', 'Nintendo Switch', 'GameCube', 'Sega Genesis', 'Game Boy Advance', 'Xbox One'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'lifestyle-hobbies',
    entityTypeSlug: 'hobby',
    title: 'Favorite Hobbies',
    prompt: 'What are your favorite hobbies to pass the time?',
    axes: ['lifestyle', 'interests', 'wellness'],
    values: ['Reading', 'Traveling', 'Cooking', 'Hiking', 'Photography', 'Gardening', 'Gaming', 'Painting', 'Writing', 'Yoga'],
    isAbstract: true
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'movie',
    title: 'Top 90s Movies',
    prompt: 'Rank your favorite movies from the 1990s.',
    axes: ['film-tv', 'nostalgia', 'entertainment'],
    values: ['Pulp Fiction', 'The Matrix', 'Fight Club', 'The Silence of the Lambs', 'Jurassic Park', 'Forrest Gump', 'Goodfellas', 'Titanic', 'Terminator 2: Judgment Day', 'The Shawshank Redemption'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'food-drink',
    entityTypeSlug: 'food',
    title: 'Favorite Desserts',
    prompt: 'What are your go-to desserts?',
    axes: ['food', 'sweet-tooth', 'comfort'],
    values: ['Chocolate Chip Cookies', 'Brownies', 'Cheesecake', 'Ice Cream', 'Tiramisu', 'Apple Pie', 'Creme Brulee', 'Chocolate Cake', 'Macarons', 'Churros'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'food-drink',
    entityTypeSlug: 'beverage',
    title: 'Favorite Coffee Drinks',
    prompt: 'What is your standard coffee order?',
    axes: ['food', 'morning-routine', 'lifestyle'],
    values: ['Latte', 'Cappuccino', 'Espresso', 'Americano', 'Macchiato', 'Flat White', 'Mocha', 'Cold Brew', 'Frappuccino', 'Cortado'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'movie',
    title: 'Top Anime Movies',
    prompt: 'Rank your favorite anime feature films.',
    axes: ['film-tv', 'animation', 'nerd'],
    values: ['Spirited Away', 'Akira', 'Princess Mononoke', 'Your Name', 'My Neighbor Totoro', 'Ghost in the Shell', 'Howl\'s Moving Castle', 'Perfect Blue', 'Grave of the Fireflies', 'A Silent Voice'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'fictional-character',
    title: 'Favorite Super Villains',
    prompt: 'Who are the best super villains of all time?',
    axes: ['entertainment', 'pop-culture', 'nerd'],
    values: ['The Joker', 'Darth Vader', 'Thanos', 'Hannibal Lecter', 'Lord Voldemort', 'Magneto', 'Loki', 'Green Goblin', 'Lex Luthor', 'Sauron'],
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
