import { db } from '../src/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function upsertEntityType(slug: string, label: string, pluralLabel: string, icon: string) {
  return db.entityType.upsert({
    where: { slug },
    update: {},
    create: { slug, label, pluralLabel, icon },
  })
}

async function upsertTag(slug: string, label: string, kind: 'DECADE' | 'GENRE' | 'PLATFORM' | 'REGION' | 'ERA' | 'CUSTOM') {
  return db.tag.upsert({ where: { slug }, update: {}, create: { slug, label, kind } })
}

async function upsertEntity(
  entityTypeId: string,
  canonicalName: string,
  opts: { metadata?: object; tagIds?: string[] } = {},
) {
  const slug = slugify(canonicalName)
  const entity = await db.entity.upsert({
    where: { entityTypeId_slug: { entityTypeId, slug } },
    update: {},
    create: {
      entityTypeId,
      canonicalName,
      slug,
      metadata: opts.metadata as any,
      sourceType: 'SEEDED',
      status: 'APPROVED',
    },
  })
  for (const tagId of opts.tagIds ?? []) {
    await db.entityTag.upsert({
      where: { entityId_tagId: { entityId: entity.id, tagId } },
      update: {},
      create: { entityId: entity.id, tagId },
    })
  }
  return entity
}

async function upsertCategory(opts: {
  groupId: string
  entityTypeId: string
  slug: string
  prompt: string
  shortLabel: string
  minItems?: number
  maxItems?: number
  orderingMode?: 'RANKED' | 'UNRANKED'
  requiredTagIds?: string[]
  metadata?: any
}) {
  const category = await db.category.upsert({
    where: { slug: opts.slug },
    update: {},
    create: {
      groupId: opts.groupId,
      entityTypeId: opts.entityTypeId,
      slug: opts.slug,
      prompt: opts.prompt,
      shortLabel: opts.shortLabel,
      minItems: opts.minItems ?? 1,
      maxItems: opts.maxItems ?? 5,
      orderingMode: opts.orderingMode ?? 'RANKED',
      metadata: opts.metadata,
    },
  })
  for (const tagId of opts.requiredTagIds ?? []) {
    await db.categoryTag.upsert({
      where: { categoryId_tagId: { categoryId: category.id, tagId } },
      update: {},
      create: { categoryId: category.id, tagId },
    })
  }
  return category
}

async function main() {
  console.log('Seeding taxonomy...')

  // ── Category groups ──────────────────────────────────────
  const groups = {
    music: await db.categoryGroup.upsert({ where: { slug: 'music' }, update: {}, create: { slug: 'music', label: 'Music', sortOrder: 0 } }),
    filmTv: await db.categoryGroup.upsert({ where: { slug: 'film-tv' }, update: {}, create: { slug: 'film-tv', label: 'Film & TV', sortOrder: 1 } }),
    food: await db.categoryGroup.upsert({ where: { slug: 'food' }, update: {}, create: { slug: 'food', label: 'Food', sortOrder: 2 } }),
    career: await db.categoryGroup.upsert({ where: { slug: 'career' }, update: {}, create: { slug: 'career', label: 'Career', sortOrder: 3 } }),
    tech: await db.categoryGroup.upsert({ where: { slug: 'tech' }, update: {}, create: { slug: 'tech', label: 'Tech', sortOrder: 4 } }),
    gaming: await db.categoryGroup.upsert({ where: { slug: 'gaming' }, update: {}, create: { slug: 'gaming', label: 'Gaming', sortOrder: 5 } }),
    creators: await db.categoryGroup.upsert({ where: { slug: 'creators' }, update: {}, create: { slug: 'creators', label: 'Creators', sortOrder: 6 } }),
    geography: await db.categoryGroup.upsert({ where: { slug: 'geography' }, update: {}, create: { slug: 'geography', label: 'Geography', sortOrder: 7 } }),
    craft: await db.categoryGroup.upsert({ where: { slug: 'craft' }, update: {}, create: { slug: 'craft', label: 'Craft & Hobbies', sortOrder: 8 } }),
    literature: await db.categoryGroup.upsert({ where: { slug: 'literature' }, update: {}, create: { slug: 'literature', label: 'Literature', sortOrder: 9 } }),
    lifestyle: await db.categoryGroup.upsert({ where: { slug: 'lifestyle' }, update: {}, create: { slug: 'lifestyle', label: 'Lifestyle & Hobbies', sortOrder: 10 } }),
    travel: await db.categoryGroup.upsert({ where: { slug: 'travel' }, update: {}, create: { slug: 'travel', label: 'Travel & Places', sortOrder: 11 } }),
    sports: await db.categoryGroup.upsert({ where: { slug: 'sports' }, update: {}, create: { slug: 'sports', label: 'Sports', sortOrder: 12 } }),
    podcasts: await db.categoryGroup.upsert({ where: { slug: 'podcasts' }, update: {}, create: { slug: 'podcasts', label: 'Podcasts', sortOrder: 13 } }),
    tabletop: await db.categoryGroup.upsert({ where: { slug: 'tabletop' }, update: {}, create: { slug: 'tabletop', label: 'Tabletop & Board Games', sortOrder: 14 } }),
  }

  // ── Entity types ─────────────────────────────────────────
  const band = await upsertEntityType('band', 'Band', 'Bands', 'music')
  const movie = await upsertEntityType('movie', 'Movie', 'Movies', 'film')
  const fruit = await upsertEntityType('fruit', 'Fruit', 'Fruits', 'apple')
  const jobTitle = await upsertEntityType('job-title', 'Job Title', 'Job Titles', 'briefcase')
  const usState = await upsertEntityType('us-state', 'U.S. State', 'U.S. States', 'map')
  const ide = await upsertEntityType('ide', 'IDE / Editor', 'IDEs & Editors', 'code')
  const sewingMachine = await upsertEntityType('sewing-machine', 'Sewing Machine', 'Sewing Machines', 'scissors')
  const mobileDevice = await upsertEntityType('mobile-device', 'Mobile Device', 'Mobile Devices', 'smartphone')
  const videoGame = await upsertEntityType('video-game', 'Video Game', 'Video Games', 'gamepad')
  const youtuber = await upsertEntityType('youtuber', 'YouTuber', 'YouTubers', 'video')
  const twitchStreamer = await upsertEntityType('twitch-streamer', 'Twitch Streamer', 'Twitch Streamers', 'twitch')
  const author = await upsertEntityType('author', 'Author', 'Authors', 'book')
  const tvShow = await upsertEntityType('tv-show', 'TV Show', 'TV Shows', 'tv')
  const album = await upsertEntityType('album', 'Album', 'Albums', 'disc')
  const groceryStore = await upsertEntityType('grocery-store', 'Grocery Store', 'Grocery Stores', 'shopping-cart')
  const fastFood = await upsertEntityType('fast-food-chain', 'Fast Food Chain', 'Fast Food Chains', 'burger')
  const coffeeChain = await upsertEntityType('coffee-chain', 'Coffee Chain', 'Coffee Chains', 'coffee')
  const clothingBrand = await upsertEntityType('clothing-brand', 'Clothing Brand', 'Clothing Brands', 'shirt')
  const hotelChain = await upsertEntityType('hotel-chain', 'Hotel Chain', 'Hotel Chains', 'hotel')
  const retailStore = await upsertEntityType('retail-store', 'Retail Store', 'Retail Stores', 'shopping-bag')
  const programmingLanguage = await upsertEntityType('programming-language', 'Programming Language', 'Programming Languages', 'code')
  const airline = await upsertEntityType('airline', 'Airline', 'Airlines', 'plane')
  const carBrand = await upsertEntityType('car-brand', 'Car Brand', 'Car Brands', 'car')
  const socialMedia = await upsertEntityType('social-media', 'Social Media', 'Social Media Apps', 'smartphone')
  const streamingService = await upsertEntityType('streaming-service', 'Streaming Service', 'Streaming Services', 'play')
  const gymChain = await upsertEntityType('gym-chain', 'Gym Chain', 'Gym Chains', 'activity')
  const sportsTeam = await upsertEntityType('sports-team', 'Sports Team', 'Sports Teams', 'shield')
  const athlete = await upsertEntityType('athlete', 'Athlete', 'Athletes', 'activity')
  const book = await upsertEntityType('book', 'Book', 'Books', 'book')
  const podcast = await upsertEntityType('podcast', 'Podcast', 'Podcasts', 'mic')
  const boardGame = await upsertEntityType('board-game', 'Board Game', 'Board Games', 'box')
  const musicFestival = await upsertEntityType('music-festival', 'Music Festival', 'Music Festivals', 'music')
  const pizzaTopping = await upsertEntityType('pizza-topping', 'Pizza Topping', 'Pizza Toppings', 'pie-chart')
  const workplacePerk = await upsertEntityType('workplace-perk', 'Workplace Perk', 'Workplace Perks', 'coffee')
  const webBrowser = await upsertEntityType('web-browser', 'Web Browser', 'Web Browsers', 'globe')
  const gameConsole = await upsertEntityType('game-console', 'Game Console', 'Game Consoles', 'monitor')
  const country = await upsertEntityType('country', 'Country', 'Countries', 'map')
  const craftMedium = await upsertEntityType('craft-medium', 'Craft Medium', 'Craft Mediums', 'pen-tool')
  const bookGenre = await upsertEntityType('book-genre', 'Book Genre', 'Book Genres', 'book-open')
  const weekendActivity = await upsertEntityType('weekend-activity', 'Weekend Activity', 'Weekend Activities', 'sun')
  const musicalInstrument = await upsertEntityType('musical-instrument', 'Musical Instrument', 'Musical Instruments', 'music')
  const movieDirector = await upsertEntityType('movie-director', 'Movie Director', 'Movie Directors', 'film')
  const cuisine = await upsertEntityType('cuisine', 'Cuisine', 'Cuisines', 'globe')
  const petPeeve = await upsertEntityType('pet-peeve', 'Pet Peeve', 'Pet Peeves', 'alert-circle')
  const techGadget = await upsertEntityType('tech-gadget', 'Tech Gadget', 'Tech Gadgets', 'cpu')
  const videoGameGenre = await upsertEntityType('video-game-genre', 'Video Game Genre', 'Video Game Genres', 'gamepad')
  const contentFormat = await upsertEntityType('content-format', 'Content Format', 'Content Formats', 'layout')
  const nationalPark = await upsertEntityType('national-park', 'National Park', 'National Parks', 'map')
  const artStyle = await upsertEntityType('art-style', 'Art Style', 'Art Styles', 'pen-tool')
  const fictionalUniverse = await upsertEntityType('fictional-universe', 'Fictional Universe', 'Fictional Universes', 'book-open')
  const workoutType = await upsertEntityType('workout-type', 'Workout Type', 'Workout Types', 'activity')

  // ── Tags ─────────────────────────────────────────────────
  const decade1990s = await upsertTag('decade-1990s', '1990s', 'DECADE')
  const decade2000s = await upsertTag('decade-2000s', '2000s', 'DECADE')
  const decade2010s = await upsertTag('decade-2010s', '2010s', 'DECADE')
  const genreAction = await upsertTag('genre-action', 'Action', 'GENRE')
  const genreHorror = await upsertTag('genre-horror', 'Horror', 'GENRE')
  const genreRock = await upsertTag('genre-rock', 'Rock', 'GENRE')
  const genrePop = await upsertTag('genre-pop', 'Pop', 'GENRE')
  const genreHipHop = await upsertTag('genre-hiphop', 'Hip Hop', 'GENRE')
  const platformPs5 = await upsertTag('platform-ps5', 'PS5', 'PLATFORM')
  const era19thCentury = await upsertTag('era-19th-century', '19th Century', 'ERA')
  const genreSciFi = await upsertTag('genre-scifi', 'Sci-Fi', 'GENRE')
  const genreFantasy = await upsertTag('genre-fantasy', 'Fantasy', 'GENRE')
  const genreTrueCrime = await upsertTag('genre-true-crime', 'True Crime', 'GENRE')
  const genreComedy = await upsertTag('genre-comedy', 'Comedy', 'GENRE')
  const sportBasketball = await upsertTag('sport-basketball', 'Basketball', 'CUSTOM')
  const sportSoccer = await upsertTag('sport-soccer', 'Soccer', 'CUSTOM')
  const genreSitcom = await upsertTag('genre-sitcom', 'Sitcom', 'GENRE')
  const genreEducation = await upsertTag('genre-education', 'Education', 'GENRE')

  // ── Entities ─────────────────────────────────────────────
  const bands90sRock = ['Nirvana', 'Oasis', 'Radiohead', 'Pearl Jam', 'The Smashing Pumpkins', 'Blur', 'Weezer', 'No Doubt', 'Green Day', 'R.E.M.']
  for (const name of bands90sRock) {
    await upsertEntity(band.id, name, { tagIds: [decade1990s.id, genreRock.id] })
  }

  const artistsPop = ['Taylor Swift', 'Lady Gaga', 'Ariana Grande', 'Dua Lipa', 'Katy Perry', 'Bruno Mars', 'The Weeknd', 'Billie Eilish']
  for (const name of artistsPop) {
    await upsertEntity(band.id, name, { tagIds: [genrePop.id, decade2010s.id] })
  }

  const artistsHipHop = ['Kendrick Lamar', 'J. Cole', 'Drake', 'Kanye West', 'Jay-Z', 'Nas', 'Wu-Tang Clan', 'Outkast', 'Tyler, the Creator']
  for (const name of artistsHipHop) {
    await upsertEntity(band.id, name, { tagIds: [genreHipHop.id] })
  }

  const movies = ['Inception', 'The Godfather', 'Pulp Fiction', 'Parasite', 'The Dark Knight', 'Get Out', 'Hereditary', 'The Shining']
  for (const name of movies) {
    const tagIds = ['Get Out', 'Hereditary', 'The Shining'].includes(name) ? [genreHorror.id] : []
    await upsertEntity(movie.id, name, { tagIds })
  }

  const fruits = ['Mango', 'Strawberry', 'Pineapple', 'Blueberry', 'Watermelon', 'Peach', 'Fig', 'Dragonfruit', 'Banana', 'Apple', 'Kiwi', 'Pomegranate', 'Orange', 'Grapes']
  for (const name of fruits) await upsertEntity(fruit.id, name)

  const jobs = ['Software Engineer', 'Marine Biologist', 'Pastry Chef', 'Architect', 'Park Ranger', 'Graphic Designer', 'Data Scientist', 'Registered Nurse', 'Electrician', 'Teacher', 'Plumber', 'Financial Analyst']
  for (const name of jobs) await upsertEntity(jobTitle.id, name)

  const states = ['Colorado', 'California', 'Vermont', 'Texas', 'Hawaii', 'Montana', 'New York', 'Florida', 'Washington', 'Illinois', 'Michigan', 'North Carolina', 'Oregon']
  for (const name of states) await upsertEntity(usState.id, name)

  const ides = ['Visual Studio Code', 'JetBrains WebStorm', 'Neovim', 'Xcode', 'Sublime Text', 'Zed', 'Eclipse', 'Vim', 'IntelliJ IDEA', 'PyCharm', 'Android Studio', 'Notepad++']
  for (const name of ides) await upsertEntity(ide.id, name)

  const sewingMachines = ['Singer Heavy Duty 4423', 'Brother CS6000i', 'Janome HD3000', 'Bernina 350', 'Juki TL-2010Q', 'Pfaff Ambition 610', 'Husqvarna Viking Jade 20', 'Brother PE800']
  for (const name of sewingMachines) await upsertEntity(sewingMachine.id, name)

  const mobileDevices = ['iPhone 15 Pro', 'Samsung Galaxy S24', 'Google Pixel 8', 'iPhone SE', 'Google Pixel 7a', 'Samsung Galaxy Z Fold 5', 'iPhone 13 mini', 'OnePlus 12', 'Motorola Edge']
  for (const name of mobileDevices) await upsertEntity(mobileDevice.id, name)

  const ps5ActionGames = ["Marvel's Spider-Man 2", 'God of War Ragnarök', 'Returnal', 'Ghost of Tsushima', 'Demon\'s Souls', 'Elden Ring', 'The Last of Us Part I', 'Horizon Forbidden West', 'Cyberpunk 2077', 'Final Fantasy XVI']
  for (const name of ps5ActionGames) await upsertEntity(videoGame.id, name, { tagIds: [platformPs5.id, genreAction.id] })

  const youtubers = ['MrBeast', 'Marques Brownlee', 'Emma Chamberlain', 'Kurzgesagt', 'PewDiePie', 'Jacksepticeye', 'Markiplier', 'MKBHD', 'Casey Neistat', 'Linus Tech Tips']
  for (const name of youtubers) await upsertEntity(youtuber.id, name)

  const streamers = ['Ninja', 'Pokimane', 'shroud', 'xQc', 'Kai Cenat', 'HasanAbi', 'Summit1g', 'Valkyrae', 'Ludwig', 'Asmongold']
  for (const name of streamers) await upsertEntity(twitchStreamer.id, name)

  const authors19th = ['Jane Austen', 'Charles Dickens', 'Mark Twain', 'Fyodor Dostoevsky', 'Emily Brontë', 'Leo Tolstoy', 'Victor Hugo', 'Herman Melville', 'Edgar Allan Poe', 'Oscar Wilde']
  for (const name of authors19th) await upsertEntity(author.id, name, { tagIds: [era19thCentury.id] })

  const tvShows = ['The Bear', 'Succession', 'White Lotus', 'Love Is Blind', 'Severance', 'Fleabag', 'I Think You Should Leave', 'The Sopranos', 'Bojack Horseman', 'Abbott Elementary', 'True Detective', 'Gilmore Girls']
  for (const name of tvShows) await upsertEntity(tvShow.id, name)

  const albums = ['Blonde - Frank Ocean', 'Rumours - Fleetwood Mac', 'SOS - SZA', 'Brat - Charli xcx', 'Songs in the Key of Life - Stevie Wonder', 'To Pimp a Butterfly - Kendrick Lamar', 'Renaissance - Beyoncé', 'In Rainbows - Radiohead', 'Igor - Tyler, the Creator']
  for (const name of albums) await upsertEntity(album.id, name)

  const groceryStores = ['Whole Foods', 'Trader Joe\'s', 'Aldi', 'Kroger', 'Publix', 'H-E-B', 'Safeway', 'Wegmans', 'Meijer']
  for (const name of groceryStores) await upsertEntity(groceryStore.id, name)

  const fastFoods = ['Sweetgreen', 'In-N-Out', 'Shake Shack', 'Taco Bell', 'Cava', 'Popeyes', 'Chipotle', 'Culver\'s', 'Waffle House']
  for (const name of fastFoods) await upsertEntity(fastFood.id, name)

  const coffeeChains = ['Starbucks', 'Peet\'s Coffee', 'Dunkin\'', 'Philz Coffee', 'Blue Bottle Coffee', 'Dutch Bros', 'Tim Hortons', 'Caribou Coffee', 'Costa Coffee']
  for (const name of coffeeChains) await upsertEntity(coffeeChain.id, name)

  const clothingBrands = ['Patagonia', 'Nike', 'Zara', 'Carhartt', 'Lululemon', 'Uniqlo', 'The North Face', 'Levi\'s', 'Adidas', 'Everlane']
  for (const name of clothingBrands) await upsertEntity(clothingBrand.id, name)

  const hotelChains = ['Marriott', 'Hilton', 'Hyatt', 'Four Seasons', 'Ritz-Carlton', 'IHG', 'Wyndham', 'Airbnb', 'Motel 6']
  for (const name of hotelChains) await upsertEntity(hotelChain.id, name)

  const retailStores = ['Target', 'IKEA', 'Costco', 'Sephora', 'Apple Store', 'Home Depot', 'Muji', 'Barnes & Noble']
  for (const name of retailStores) await upsertEntity(retailStore.id, name)

  const programmingLanguages = ['TypeScript', 'Rust', 'Go', 'Python', 'Elixir', 'Ruby on Rails', 'Zig', 'OCaml']
  for (const name of programmingLanguages) await upsertEntity(programmingLanguage.id, name)

  const airlines = ['Delta', 'United', 'Southwest', 'JetBlue', 'American Airlines', 'Alaska Airlines', 'Emirates', 'Qatar Airways', 'Singapore Airlines']
  for (const name of airlines) await upsertEntity(airline.id, name)

  const carBrands = ['Toyota', 'Honda', 'Subaru', 'Tesla', 'Ford', 'BMW', 'Volvo', 'Porsche', 'Mazda', 'Rivian']
  for (const name of carBrands) await upsertEntity(carBrand.id, name)

  const socialMedias = ['Instagram', 'TikTok', 'Twitter / X', 'Reddit', 'LinkedIn', 'Pinterest', 'Snapchat', 'BeReal', 'YouTube']
  for (const name of socialMedias) await upsertEntity(socialMedia.id, name)

  const streamingServices = ['Netflix', 'Max', 'Hulu', 'Spotify', 'Apple Music', 'Disney+', 'Prime Video', 'Crunchyroll', 'Peacock']
  for (const name of streamingServices) await upsertEntity(streamingService.id, name)

  const gymChains = ['Planet Fitness', 'Equinox', 'LA Fitness', 'Anytime Fitness', 'Crunch Fitness', '24 Hour Fitness', 'YMCA', 'Gold\'s Gym', 'OrangeTheory']
  for (const name of gymChains) await upsertEntity(gymChain.id, name)

  const basketballPlayers = ['LeBron James', 'Michael Jordan', 'Kobe Bryant', 'Stephen Curry', 'Kevin Durant', 'Giannis Antetokounmpo', 'Nikola Jokić', 'Luka Dončić']
  for (const name of basketballPlayers) await upsertEntity(athlete.id, name, { tagIds: [sportBasketball.id] })

  const soccerPlayers = ['Lionel Messi', 'Cristiano Ronaldo', 'Neymar Jr', 'Kylian Mbappé', 'Erling Haaland', 'Diego Maradona', 'Pelé']
  for (const name of soccerPlayers) await upsertEntity(athlete.id, name, { tagIds: [sportSoccer.id] })

  const sportsTeams = ['Los Angeles Lakers', 'Golden State Warriors', 'Real Madrid', 'Manchester United', 'New York Yankees', 'Boston Red Sox', 'Dallas Cowboys', 'New England Patriots']
  for (const name of sportsTeams) await upsertEntity(sportsTeam.id, name)

  const scifiBooks = ['Dune', 'The Hitchhiker\'s Guide to the Galaxy', 'Ender\'s Game', '1984', 'Foundation', 'The Martian', 'Neuromancer', 'Snow Crash']
  for (const name of scifiBooks) await upsertEntity(book.id, name, { tagIds: [genreSciFi.id] })

  const fantasyBooks = ['The Hobbit', 'The Lord of the Rings', 'Harry Potter', 'A Game of Thrones', 'The Name of the Wind', 'Mistborn', 'The Way of Kings']
  for (const name of fantasyBooks) await upsertEntity(book.id, name, { tagIds: [genreFantasy.id] })

  const podcastsList = ['The Joe Rogan Experience', 'Serial', 'My Favorite Murder', 'Huberman Lab', 'Crime Junkie', 'The Daily', 'This American Life', 'SmartLess']
  for (const name of podcastsList) {
    const tagIds = ['Serial', 'My Favorite Murder', 'Crime Junkie'].includes(name) ? [genreTrueCrime.id] : (['SmartLess'].includes(name) ? [genreComedy.id] : [])
    await upsertEntity(podcast.id, name, { tagIds })
  }

  const boardGamesList = ['Catan', 'Ticket to Ride', 'Monopoly', 'Dungeons & Dragons', 'Chess', 'Scrabble', 'Carcassonne', 'Pandemic', 'Wingspan', 'Risk']
  for (const name of boardGamesList) await upsertEntity(boardGame.id, name)

  const festivals = ['Coachella', 'Glastonbury', 'Lollapalooza', 'Tomorrowland', 'Bonnaroo', 'EDC']
  for (const name of festivals) await upsertEntity(musicFestival.id, name)

  const sitcoms = ['Friends', 'The Office', 'Seinfeld', 'Parks and Recreation', 'Brooklyn Nine-Nine', 'How I Met Your Mother', 'Arrested Development', 'The Simpsons', 'Modern Family', 'Schitt\'s Creek', 'Cheers', 'Frasier']
  for (const name of sitcoms) await upsertEntity(tvShow.id, name, { tagIds: [genreSitcom.id] })

  const toppings = ['Pepperoni', 'Mushrooms', 'Onions', 'Sausage', 'Bacon', 'Extra cheese', 'Black olives', 'Green peppers', 'Pineapple', 'Jalapeños', 'Prosciutto', 'Spinach', 'Garlic', 'Anchovies', 'Basil']
  for (const name of toppings) await upsertEntity(pizzaTopping.id, name)

  const perks = ['Remote Work', 'Flexible Hours', 'Unlimited PTO', '401k Match', 'Health Insurance', 'Free Snacks', 'Four-Day Workweek', 'Free Lunch', 'Commuter Benefits', 'Gym Membership', 'Stock Options', 'Pet-Friendly Office']
  for (const name of perks) await upsertEntity(workplacePerk.id, name)

  const browsers = ['Google Chrome', 'Mozilla Firefox', 'Safari', 'Microsoft Edge', 'Brave', 'Arc', 'Opera', 'Vivaldi', 'Tor Browser', 'Safari (Mobile)', 'DuckDuckGo Browser']
  for (const name of browsers) await upsertEntity(webBrowser.id, name)

  const consoles = ['PlayStation 2', 'PlayStation 5', 'Xbox 360', 'Xbox Series X', 'Nintendo Switch', 'Super Nintendo (SNES)', 'PC', 'Nintendo 64', 'PlayStation 1', 'Xbox One', 'Game Boy Advance', 'Sega Genesis']
  for (const name of consoles) await upsertEntity(gameConsole.id, name)

  const eduTubers = ['Kurzgesagt', 'Veritasium', 'Vsauce', 'Mark Rober', '3Blue1Brown', 'Tom Scott', 'SmarterEveryDay']
  for (const name of eduTubers) await upsertEntity(youtuber.id, name, { tagIds: [genreEducation.id] })

  const countries = ['Japan', 'Italy', 'Australia', 'New Zealand', 'Iceland', 'Switzerland', 'Greece', 'Spain']
  for (const name of countries) await upsertEntity(country.id, name)

  const mediums = ['Watercolor', 'Acrylic Paint', 'Clay', 'Yarn', 'Wood', 'Fabric', 'Digital (Procreate/Photoshop)']
  for (const name of mediums) await upsertEntity(craftMedium.id, name)

  const genres = ['Science Fiction', 'Fantasy', 'Mystery', 'Romance', 'Historical Fiction', 'Thriller', 'Non-fiction', 'Horror']
  for (const name of genres) await upsertEntity(bookGenre.id, name)

  const activities = ['Hiking', 'Reading', 'Sleeping in', 'Going to the movies', 'Visiting museums', 'Brunch', 'Video Games']
  for (const name of activities) await upsertEntity(weekendActivity.id, name)

  const instruments = ['Guitar', 'Piano', 'Drums', 'Violin', 'Saxophone', 'Bass', 'Flute', 'Cello']
  for (const name of instruments) await upsertEntity(musicalInstrument.id, name)

  const directors = ['Christopher Nolan', 'Steven Spielberg', 'Quentin Tarantino', 'Martin Scorsese', 'Greta Gerwig', 'Denis Villeneuve', 'Stanley Kubrick', 'Alfred Hitchcock', 'Francis Ford Coppola', 'Wes Anderson', 'Bong Joon Ho', 'Ridley Scott']
  for (const name of directors) await upsertEntity(movieDirector.id, name)

  const cuisines = ['Italian', 'Mexican', 'Japanese', 'Indian', 'Thai', 'Chinese', 'French', 'Mediterranean']
  for (const name of cuisines) await upsertEntity(cuisine.id, name)

  const peeves = ['Micro-management', 'Meaningless Meetings', 'Reply-All Emails', 'Coworkers chewing loudly', 'Slow Wi-Fi', 'Office politics', 'Microwaving Fish', 'Leaving the printer jammed', 'Taking credit for others\' work', 'Last-minute meetings']
  for (const name of peeves) await upsertEntity(petPeeve.id, name)

  const gadgets = ['Smartphone', 'Noise-canceling headphones', 'Smartwatch', 'E-reader', 'Tablet', 'Laptop', 'Power bank', 'VR Headset', 'Mechanical Keyboard', 'Drone', 'Smart Home Hub', 'Action Camera']
  for (const name of gadgets) await upsertEntity(techGadget.id, name)

  const vgGenres = ['RPGs', 'First-Person Shooters', 'Puzzle', 'Strategy', 'Platformers', 'Survival', 'Battle Royale', 'MMORPG']
  for (const name of vgGenres) await upsertEntity(videoGameGenre.id, name)

  const formats = ['Long-form video essays', 'Short-form (TikToks/Reels)', 'Podcasts', 'Newsletters', 'Live streams', 'Vlogs']
  for (const name of formats) await upsertEntity(contentFormat.id, name)

  const parks = ['Yellowstone', 'Yosemite', 'Grand Canyon', 'Zion', 'Glacier', 'Rocky Mountain', 'Acadia', 'Arches', 'Olympic', 'Great Smoky Mountains', 'Joshua Tree', 'Denali']
  for (const name of parks) await upsertEntity(nationalPark.id, name)

  const artStyles = ['Impressionism', 'Surrealism', 'Abstract', 'Pop Art', 'Realism', 'Cubism', 'Minimalism', 'Baroque', 'Renaissance', 'Rococo', 'Expressionism', 'Romanticism']
  for (const name of artStyles) await upsertEntity(artStyle.id, name)

  const universes = ['Harry Potter', 'Lord of the Rings', 'Star Wars', 'Marvel Cinematic Universe', 'Star Trek', 'Percy Jackson', 'Dune']
  for (const name of universes) await upsertEntity(fictionalUniverse.id, name)

  const workouts = ['Weightlifting', 'Running', 'Yoga', 'Cycling', 'Swimming', 'Pilates', 'HIIT', 'Hiking']
  for (const name of workouts) await upsertEntity(workoutType.id, name)

  // ── Categories ───────────────────────────────────────────
  await upsertCategory({
    groupId: groups.music.id,
    entityTypeId: band.id,
    slug: 'top-90s-bands',
    prompt: 'What are your top 5 90s bands?',
    shortLabel: 'Top 90s Bands',
    maxItems: 5,
    requiredTagIds: [decade1990s.id],
  })
  await upsertCategory({
    groupId: groups.music.id,
    entityTypeId: band.id,
    slug: 'top-rock-bands',
    prompt: 'What are your favorite rock bands?',
    shortLabel: 'Top Rock Bands',
    maxItems: 5,
    requiredTagIds: [genreRock.id],
  })
  await upsertCategory({
    groupId: groups.music.id,
    entityTypeId: band.id,
    slug: 'top-pop-artists',
    prompt: 'Who are your favorite pop artists?',
    shortLabel: 'Top Pop Artists',
    maxItems: 5,
    requiredTagIds: [genrePop.id],
    metadata: { insightTags: ['pop-culture', 'extrovert'] },
  })
  await upsertCategory({
    groupId: groups.music.id,
    entityTypeId: band.id,
    slug: 'top-hiphop-artists',
    prompt: 'Who are your favorite hip hop artists?',
    shortLabel: 'Top Hip Hop Artists',
    maxItems: 5,
    requiredTagIds: [genreHipHop.id],
  })
  await upsertCategory({
    groupId: groups.music.id,
    entityTypeId: band.id,
    slug: 'favorite-artists-all-time',
    prompt: 'Who are your favorite music artists of all time?',
    shortLabel: 'Favorite Artists',
    maxItems: 5,
    // No required tags, so ANY band/artist can be selected here.
  })
  await upsertCategory({
    groupId: groups.filmTv.id,
    entityTypeId: movie.id,
    slug: 'top-movies',
    prompt: 'What are your top 5 movies of all time?',
    shortLabel: 'Top Movies',
    maxItems: 5,
  })
  await upsertCategory({
    groupId: groups.filmTv.id,
    entityTypeId: movie.id,
    slug: 'favorite-horror-movies',
    prompt: 'What are your favorite horror movies?',
    shortLabel: 'Horror Movies',
    maxItems: 5,
    requiredTagIds: [genreHorror.id],
  })
  await upsertCategory({
    groupId: groups.food.id,
    entityTypeId: fruit.id,
    slug: 'top-fruits',
    prompt: 'What are your top 3 fruits?',
    shortLabel: 'Top Fruits',
    maxItems: 3,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.career.id,
    entityTypeId: jobTitle.id,
    slug: 'dream-job',
    prompt: 'What is your dream job?',
    shortLabel: 'Dream Job',
    minItems: 1,
    maxItems: 1,
  })
  await upsertCategory({
    groupId: groups.geography.id,
    entityTypeId: usState.id,
    slug: 'favorite-state',
    prompt: 'What is your favorite state to live in?',
    shortLabel: 'Favorite State',
    minItems: 1,
    maxItems: 1,
  })
  await upsertCategory({
    groupId: groups.tech.id,
    entityTypeId: ide.id,
    slug: 'favorite-ide',
    prompt: 'What is your favorite IDE or editor?',
    shortLabel: 'Favorite IDE',
    minItems: 1,
    maxItems: 1,
  })
  await upsertCategory({
    groupId: groups.craft.id,
    entityTypeId: sewingMachine.id,
    slug: 'favorite-sewing-machine',
    prompt: 'What is your favorite sewing machine?',
    shortLabel: 'Favorite Sewing Machine',
    minItems: 1,
    maxItems: 1,
  })
  await upsertCategory({
    groupId: groups.tech.id,
    entityTypeId: mobileDevice.id,
    slug: 'current-phone',
    prompt: 'What phone do you currently use?',
    shortLabel: 'Current Phone',
    minItems: 1,
    maxItems: 1,
  })
  await upsertCategory({
    groupId: groups.gaming.id,
    entityTypeId: videoGame.id,
    slug: 'top-ps5-action-games',
    prompt: 'What are your top 5 PS5 action games?',
    shortLabel: 'Top PS5 Action Games',
    maxItems: 5,
    requiredTagIds: [platformPs5.id, genreAction.id],
  })
  await upsertCategory({
    groupId: groups.creators.id,
    entityTypeId: youtuber.id,
    slug: 'favorite-youtubers',
    prompt: 'Who are your favorite YouTubers?',
    shortLabel: 'Favorite YouTubers',
    maxItems: 5,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.creators.id,
    entityTypeId: twitchStreamer.id,
    slug: 'favorite-twitch-streamers',
    prompt: 'Who are your favorite Twitch streamers?',
    shortLabel: 'Favorite Twitch Streamers',
    maxItems: 5,
    orderingMode: 'UNRANKED',
  })
  const authorsCategory = await upsertCategory({
    groupId: groups.literature.id,
    entityTypeId: author.id,
    slug: 'favorite-19th-century-authors',
    prompt: 'Who are your favorite 19th-century authors?',
    shortLabel: '19th-Century Authors',
    maxItems: 5,
    requiredTagIds: [era19thCentury.id],
  })

  await upsertCategory({
    groupId: groups.filmTv.id,
    entityTypeId: tvShow.id,
    slug: 'top-tv-shows',
    prompt: 'What are your top 5 TV shows of all time?',
    shortLabel: 'Top TV Shows',
    maxItems: 5,
  })
  await upsertCategory({
    groupId: groups.music.id,
    entityTypeId: album.id,
    slug: 'top-albums',
    prompt: 'What are your top 5 albums of all time?',
    shortLabel: 'Top Albums',
    maxItems: 5,
  })
  await upsertCategory({
    groupId: groups.food.id,
    entityTypeId: groceryStore.id,
    slug: 'favorite-grocery-store',
    prompt: 'What is your favorite grocery store?',
    shortLabel: 'Favorite Grocery Store',
    maxItems: 3,
    orderingMode: 'UNRANKED',
    metadata: { insightTags: ['foodie', 'domestic'] },
  })
  await upsertCategory({
    groupId: groups.food.id,
    entityTypeId: fastFood.id,
    slug: 'go-to-fast-food',
    prompt: 'What is your go-to fast food chain?',
    shortLabel: 'Go-To Fast Food',
    minItems: 1,
    maxItems: 3,
  })
  await upsertCategory({
    groupId: groups.food.id,
    entityTypeId: coffeeChain.id,
    slug: 'go-to-coffee-chain',
    prompt: 'What is your go-to coffee chain?',
    shortLabel: 'Go-To Coffee Chain',
    maxItems: 3,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.lifestyle.id,
    entityTypeId: clothingBrand.id,
    slug: 'favorite-clothing-brands',
    prompt: 'What are your favorite clothing brands?',
    shortLabel: 'Favorite Clothing Brands',
    maxItems: 5,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.travel.id,
    entityTypeId: hotelChain.id,
    slug: 'go-to-hotel-chain',
    prompt: 'What is your preferred hotel chain?',
    shortLabel: 'Go-To Hotel Chain',
    maxItems: 3,
  })
  await upsertCategory({
    groupId: groups.lifestyle.id,
    entityTypeId: retailStore.id,
    slug: 'favorite-retail-stores',
    prompt: 'What are your favorite retail stores?',
    shortLabel: 'Favorite Retail Stores',
    maxItems: 5,
  })
  await upsertCategory({
    groupId: groups.tech.id,
    entityTypeId: programmingLanguage.id,
    slug: 'go-to-programming-language',
    prompt: 'What is your go-to programming language?',
    shortLabel: 'Go-To Language',
    minItems: 1,
    maxItems: 3,
  })
  await upsertCategory({
    groupId: groups.travel.id,
    entityTypeId: airline.id,
    slug: 'preferred-airline',
    prompt: 'What is your preferred airline?',
    shortLabel: 'Preferred Airline',
    maxItems: 3,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.lifestyle.id,
    entityTypeId: carBrand.id,
    slug: 'favorite-car-brands',
    prompt: 'What are your favorite car brands?',
    shortLabel: 'Favorite Car Brands',
    maxItems: 3,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.tech.id,
    entityTypeId: socialMedia.id,
    slug: 'most-used-social-media',
    prompt: 'Which social media do you use most?',
    shortLabel: 'Most Used Social Media',
    maxItems: 3,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.filmTv.id,
    entityTypeId: streamingService.id,
    slug: 'essential-streaming-services',
    prompt: 'What are your essential streaming services?',
    shortLabel: 'Essential Streaming Services',
    maxItems: 4,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.lifestyle.id,
    entityTypeId: gymChain.id,
    slug: 'favorite-gym-chain',
    prompt: 'What is your go-to gym chain?',
    shortLabel: 'Go-To Gym Chain',
    maxItems: 1,
    metadata: { insightTags: ['active', 'fitness'] },
  })
  await upsertCategory({
    groupId: groups.sports.id,
    entityTypeId: sportsTeam.id,
    slug: 'favorite-sports-teams',
    prompt: 'What are your favorite sports teams?',
    shortLabel: 'Favorite Sports Teams',
    maxItems: 5,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.sports.id,
    entityTypeId: athlete.id,
    slug: 'top-athletes',
    prompt: 'Who are your top 3 favorite athletes?',
    shortLabel: 'Top Athletes',
    maxItems: 3,
  })
  await upsertCategory({
    groupId: groups.literature.id,
    entityTypeId: book.id,
    slug: 'favorite-books',
    prompt: 'What are your top 5 favorite books?',
    shortLabel: 'Favorite Books',
    maxItems: 5,
  })
  await upsertCategory({
    groupId: groups.literature.id,
    entityTypeId: book.id,
    slug: 'favorite-scifi-books',
    prompt: 'What are your favorite Sci-Fi books?',
    shortLabel: 'Favorite Sci-Fi Books',
    maxItems: 5,
    requiredTagIds: [genreSciFi.id],
  })
  await upsertCategory({
    groupId: groups.podcasts.id,
    entityTypeId: podcast.id,
    slug: 'top-podcasts',
    prompt: 'What are your must-listen podcasts?',
    shortLabel: 'Top Podcasts',
    maxItems: 5,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.tabletop.id,
    entityTypeId: boardGame.id,
    slug: 'favorite-board-games',
    prompt: 'What are your top 5 favorite board games?',
    shortLabel: 'Favorite Board Games',
    maxItems: 5,
  })
  
  await upsertCategory({
    groupId: groups.music.id,
    entityTypeId: musicFestival.id,
    slug: 'favorite-music-festivals',
    prompt: 'What are your favorite music festivals?',
    shortLabel: 'Favorite Music Festivals',
    maxItems: 5,
  })
  await upsertCategory({
    groupId: groups.filmTv.id,
    entityTypeId: tvShow.id,
    slug: 'top-sitcoms',
    prompt: 'What are your top 5 favorite sitcoms?',
    shortLabel: 'Favorite Sitcoms',
    maxItems: 5,
    requiredTagIds: [genreSitcom.id],
  })
  await upsertCategory({
    groupId: groups.food.id,
    entityTypeId: pizzaTopping.id,
    slug: 'essential-pizza-toppings',
    prompt: 'What are your essential pizza toppings?',
    shortLabel: 'Pizza Toppings',
    maxItems: 5,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.career.id,
    entityTypeId: workplacePerk.id,
    slug: 'favorite-workplace-perks',
    prompt: 'What workplace perks matter most to you?',
    shortLabel: 'Workplace Perks',
    maxItems: 5,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.tech.id,
    entityTypeId: webBrowser.id,
    slug: 'primary-web-browser',
    prompt: 'What is your primary web browser?',
    shortLabel: 'Primary Browser',
    minItems: 1,
    maxItems: 1,
  })
  await upsertCategory({
    groupId: groups.gaming.id,
    entityTypeId: gameConsole.id,
    slug: 'favorite-game-consoles',
    prompt: 'What is your favorite video game console of all time?',
    shortLabel: 'Favorite Console',
    maxItems: 3,
  })
  await upsertCategory({
    groupId: groups.creators.id,
    entityTypeId: youtuber.id,
    slug: 'favorite-edutubers',
    prompt: 'Who are your favorite educational YouTubers?',
    shortLabel: 'Educational YouTubers',
    maxItems: 5,
    requiredTagIds: [genreEducation.id],
  })
  await upsertCategory({
    groupId: groups.geography.id,
    entityTypeId: country.id,
    slug: 'dream-travel-destinations',
    prompt: 'What are your dream travel destinations?',
    shortLabel: 'Dream Travel Destinations',
    maxItems: 5,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.craft.id,
    entityTypeId: craftMedium.id,
    slug: 'favorite-craft-medium',
    prompt: 'What is your favorite craft medium to work with?',
    shortLabel: 'Craft Medium',
    maxItems: 3,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.literature.id,
    entityTypeId: bookGenre.id,
    slug: 'favorite-book-genres',
    prompt: 'What are your favorite book genres?',
    shortLabel: 'Book Genres',
    maxItems: 5,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.lifestyle.id,
    entityTypeId: weekendActivity.id,
    slug: 'ideal-weekend-activity',
    prompt: 'What is your ideal weekend activity?',
    shortLabel: 'Weekend Activity',
    maxItems: 3,
    orderingMode: 'UNRANKED',
  })

  // Wave 2 Polls
  await upsertCategory({
    groupId: groups.music.id,
    entityTypeId: musicalInstrument.id,
    slug: 'musical-instruments-played',
    prompt: 'What musical instruments do you play (or wish you could)?',
    shortLabel: 'Musical Instruments',
    maxItems: 3,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.filmTv.id,
    entityTypeId: movieDirector.id,
    slug: 'favorite-movie-directors',
    prompt: 'Who are your favorite movie directors?',
    shortLabel: 'Favorite Directors',
    maxItems: 5,
  })
  await upsertCategory({
    groupId: groups.food.id,
    entityTypeId: cuisine.id,
    slug: 'favorite-cuisines',
    prompt: 'What are your favorite cuisines?',
    shortLabel: 'Favorite Cuisines',
    maxItems: 5,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.career.id,
    entityTypeId: petPeeve.id,
    slug: 'biggest-workplace-pet-peeves',
    prompt: 'What are your biggest workplace pet peeves?',
    shortLabel: 'Workplace Pet Peeves',
    maxItems: 3,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.tech.id,
    entityTypeId: techGadget.id,
    slug: 'essential-tech-gadgets',
    prompt: 'What tech gadgets can\'t you live without?',
    shortLabel: 'Essential Gadgets',
    maxItems: 3,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.gaming.id,
    entityTypeId: videoGameGenre.id,
    slug: 'favorite-video-game-genres',
    prompt: 'What are your favorite video game genres?',
    shortLabel: 'Favorite Game Genres',
    maxItems: 3,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.creators.id,
    entityTypeId: contentFormat.id,
    slug: 'favorite-content-formats',
    prompt: 'What is your favorite type of content to consume?',
    shortLabel: 'Favorite Content Formats',
    maxItems: 3,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.geography.id,
    entityTypeId: nationalPark.id,
    slug: 'favorite-national-parks',
    prompt: 'What are your favorite US National Parks?',
    shortLabel: 'Favorite National Parks',
    maxItems: 5,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.craft.id,
    entityTypeId: artStyle.id,
    slug: 'favorite-art-styles',
    prompt: 'What are your favorite art styles?',
    shortLabel: 'Favorite Art Styles',
    maxItems: 3,
    orderingMode: 'UNRANKED',
  })
  await upsertCategory({
    groupId: groups.literature.id,
    entityTypeId: fictionalUniverse.id,
    slug: 'ideal-fictional-universe',
    prompt: 'Which fictional universe would you most want to live in?',
    shortLabel: 'Fictional Universe',
    maxItems: 1,
  })
  await upsertCategory({
    groupId: groups.lifestyle.id,
    entityTypeId: workoutType.id,
    slug: 'favorite-workouts',
    prompt: 'What are your favorite ways to exercise?',
    shortLabel: 'Favorite Workouts',
    maxItems: 3,
    orderingMode: 'UNRANKED',
  })

  // ── Site Picks ───────────────────────────────────────────
  // 12 admin-curated groups of exactly 4 existing List Definitions each —
  // surfaced by ContentFeedService.getListsFeed immediately after "Your
  // lists" and before the first Quick Picks beat. References the Category
  // rows seeded above by slug; nothing is duplicated. Each group's own
  // `label` is what actually renders as that grid's title in the feed — see
  // AdminSitePicksScreen for the equivalent admin editor.
  console.log('Seeding Site Picks...')
  // Slugs deliberately bare (no "site-picks-" prefix) — ContentFeedService
  // prefixes the feed module id with "site-picks-" itself; prefixing here
  // too would double it up (site-picks-site-picks-music).
  const sitePicksGroups: { slug: string; label: string; categorySlugs: string[] }[] = [
    { slug: 'music', label: 'Music', categorySlugs: ['top-90s-bands', 'top-rock-bands', 'top-pop-artists', 'top-hiphop-artists'] },
    { slug: 'film-tv', label: 'Video', categorySlugs: ['top-movies', 'favorite-horror-movies', 'top-tv-shows', 'top-sitcoms'] },
    { slug: 'food', label: 'Food & drink', categorySlugs: ['go-to-fast-food', 'go-to-coffee-chain', 'essential-pizza-toppings', 'favorite-cuisines'] },
    { slug: 'gaming', label: 'Gaming', categorySlugs: ['top-ps5-action-games', 'favorite-board-games', 'favorite-game-consoles', 'favorite-video-game-genres'] },
    { slug: 'tech', label: 'Tech', categorySlugs: ['favorite-ide', 'go-to-programming-language', 'primary-web-browser', 'essential-tech-gadgets'] },
    { slug: 'creators', label: 'Creators', categorySlugs: ['favorite-youtubers', 'favorite-twitch-streamers', 'favorite-edutubers', 'top-podcasts'] },
    { slug: 'career', label: 'Career', categorySlugs: ['dream-job', 'favorite-workplace-perks', 'biggest-workplace-pet-peeves', 'ideal-weekend-activity'] },
    { slug: 'travel', label: 'Travel', categorySlugs: ['favorite-state', 'dream-travel-destinations', 'favorite-national-parks', 'preferred-airline'] },
    { slug: 'sports', label: 'Fitness', categorySlugs: ['favorite-sports-teams', 'top-athletes', 'favorite-workouts', 'favorite-gym-chain'] },
    { slug: 'books', label: 'Books', categorySlugs: ['favorite-books', 'favorite-scifi-books', 'favorite-book-genres', 'favorite-19th-century-authors'] },
    { slug: 'brands', label: 'Brands', categorySlugs: ['favorite-clothing-brands', 'favorite-retail-stores', 'favorite-car-brands', 'go-to-hotel-chain'] },
    { slug: 'craft', label: 'Culture', categorySlugs: ['favorite-craft-medium', 'favorite-art-styles', 'favorite-music-festivals', 'favorite-movie-directors'] },
  ]

  const allSitePickSlugs = sitePicksGroups.flatMap((g) => g.categorySlugs)
  const sitePickCategories = await db.category.findMany({ where: { slug: { in: allSitePickSlugs } }, select: { id: true, slug: true } })
  const categoryIdBySlug = new Map(sitePickCategories.map((c) => [c.slug, c.id]))

  for (const [index, group] of sitePicksGroups.entries()) {
    const sitePickGroup = await db.sitePickGroup.upsert({
      where: { slug: group.slug },
      update: { label: group.label, sortOrder: index },
      create: { slug: group.slug, label: group.label, sortOrder: index },
    })
    for (const [itemIndex, categorySlug] of group.categorySlugs.entries()) {
      const categoryId = categoryIdBySlug.get(categorySlug)
      if (!categoryId) continue
      await db.sitePickItem.upsert({
        where: { groupId_categoryId: { groupId: sitePickGroup.id, categoryId } },
        update: { sortOrder: itemIndex },
        create: { groupId: sitePickGroup.id, categoryId, sortOrder: itemIndex },
      })
    }
  }

  // ── Plans ────────────────────────────────────────────────
  // NOTE: the `features` JSON column this block's upserts once targeted no
  // longer exists on the Plan model (schema drift predating this session) —
  // dropped here since `db.plan.upsert` now rejects the unknown argument.
  await db.plan.upsert({
    where: { slug: 'premium-monthly' },
    update: {},
    create: { slug: 'premium-monthly', label: 'Premium Monthly', interval: 'MONTHLY', priceCents: 999 },
  })
  await db.plan.upsert({
    where: { slug: 'premium-annual' },
    update: {},
    create: { slug: 'premium-annual', label: 'Premium Annual', interval: 'ANNUAL', priceCents: 7999 },
  })

  console.log('Seeding complete.')
  console.log('Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
