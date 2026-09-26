import { ListImporterService, ListSeedInput } from '../services/ListImporterService'

const listsToImport: ListSeedInput[] = [
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'superhero',
    title: 'Favorite Superheroes',
    prompt: 'Who are your all-time favorite superheroes?',
    axes: ['entertainment', 'pop-culture', 'fandom'],
    values: ['Spider-Man', 'Batman', 'Superman', 'Wonder Woman', 'Iron Man', 'Captain America', 'Wolverine', 'The Flash', 'Thor', 'Black Panther', 'Hulk', 'Deadpool', 'Green Lantern', 'Aquaman'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'anime',
    title: 'Top Anime Series',
    prompt: 'What are your favorite anime series?',
    axes: ['entertainment', 'animation', 'nerd'],
    values: ['Death Note', 'Attack on Titan', 'Fullmetal Alchemist: Brotherhood', 'Naruto', 'One Piece', 'Dragon Ball Z', 'Cowboy Bebop', 'Neon Genesis Evangelion', 'Demon Slayer', 'My Hero Academia', 'Hunter x Hunter', 'Spirited Away'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'food-drink',
    entityTypeSlug: 'candy',
    title: 'Favorite Candy Bars',
    prompt: 'Rank your go-to candy bars.',
    axes: ['food', 'snacks', 'comfort'],
    values: ['Snickers', 'Reese\'s Peanut Butter Cups', 'Twix', 'Kit Kat', 'Milky Way', 'Butterfinger', 'Hershey\'s', 'M&M\'s', 'PayDay', 'Almond Joy', '100 Grand', 'Crunch Bar'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'food-drink',
    entityTypeSlug: 'cocktail',
    title: 'Go-To Cocktails',
    prompt: 'What are your go-to cocktails?',
    axes: ['food', 'nightlife', 'social'],
    values: ['Margarita', 'Old Fashioned', 'Martini', 'Mojito', 'Moscow Mule', 'Negroni', 'Whiskey Sour', 'Cosmopolitan', 'Pina Colada', 'Espresso Martini', 'Aperol Spritz', 'Bloody Mary'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'lifestyle-hobbies',
    entityTypeSlug: 'dog-breed',
    title: 'Favorite Dog Breeds',
    prompt: 'Rank your favorite dog breeds.',
    axes: ['lifestyle', 'pets', 'home'],
    values: ['Golden Retriever', 'Labrador Retriever', 'French Bulldog', 'German Shepherd', 'Poodle', 'Bulldog', 'Beagle', 'Rottweiler', 'Dachshund', 'Corgi', 'Husky', 'Pug', 'Boxer', 'Border Collie'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'lifestyle-hobbies',
    entityTypeSlug: 'car',
    title: 'Dream Cars',
    prompt: 'What is your absolute dream car?',
    axes: ['lifestyle', 'automotive', 'ambition'],
    values: ['Porsche 911', 'Ferrari 458', 'Lamborghini Aventador', 'Tesla Model S', 'Ford Mustang', 'Chevrolet Corvette', 'Aston Martin DB11', 'McLaren 720S', 'Audi R8', 'BMW M3', 'Mercedes-Benz G-Class', 'Toyota Supra'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'lifestyle-hobbies',
    entityTypeSlug: 'sneaker',
    title: 'Favorite Sneakers',
    prompt: 'What are your favorite sneaker silhouettes?',
    axes: ['lifestyle', 'fashion', 'streetwear'],
    values: ['Nike Air Jordan 1', 'Nike Air Force 1', 'Adidas Yeezy Boost 350', 'Adidas Stan Smith', 'Nike Dunk Low', 'Converse Chuck Taylor', 'Vans Old Skool', 'New Balance 990', 'Nike Air Max 90', 'Adidas Samba', 'Puma Suede'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'reality-show',
    title: 'Top Reality TV Shows',
    prompt: 'Which reality TV shows are your guilty pleasures?',
    axes: ['film-tv', 'entertainment', 'guilty-pleasure'],
    values: ['Survivor', 'The Bachelor', 'Vanderpump Rules', 'RuPaul\'s Drag Race', 'Keeping Up with the Kardashians', 'The Traitors', 'Love Is Blind', 'Big Brother', 'The Challenge', 'Top Chef', '90 Day Fiance', 'Real Housewives'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'lifestyle-hobbies',
    entityTypeSlug: 'city',
    title: 'Favorite World Cities',
    prompt: 'Which cities in the world do you love most?',
    axes: ['travel', 'culture', 'lifestyle'],
    values: ['London', 'Paris', 'Tokyo', 'New York City', 'Rome', 'Barcelona', 'Berlin', 'Amsterdam', 'Sydney', 'Seoul', 'Los Angeles', 'Chicago', 'Toronto', 'Singapore'],
    isAbstract: false
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'musical',
    title: 'Favorite Musicals',
    prompt: 'Rank your all-time favorite stage musicals.',
    axes: ['entertainment', 'theater', 'music'],
    values: ['Hamilton', 'Wicked', 'The Phantom of the Opera', 'Les Misérables', 'Rent', 'Sweeney Todd', 'Chicago', 'The Lion King', 'Dear Evan Hansen', 'Hadestown', 'Into the Woods', 'West Side Story'],
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
    }
    i++
  }
}

run().catch(console.error).finally(() => process.exit(0))
