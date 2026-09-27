import { ListImporterService, ListSeedInput } from '../services/ListImporterService'

const listsToImport: ListSeedInput[] = [
  {
    schemaVersion: 1,
    groupSlug: 'creators',
    entityTypeSlug: 'meme',
    title: 'Favorite Classic Memes',
    prompt: 'What are your all-time favorite classic memes?',
    axes: ['internet-culture', 'comedy', 'nostalgia'],
    values: ['Doge', 'Rickroll', 'Pepe the Frog', 'Nyan Cat', 'Harambe', 'Distracted Boyfriend', 'Trollface', 'Woman Yelling at a Cat', 'Success Kid', 'Grumpy Cat'],
    isAbstract: true
  },
  {
    schemaVersion: 1,
    groupSlug: 'tech',
    entityTypeSlug: 'internet-trend',
    title: 'Favorite Internet Trends',
    prompt: 'Which internet trends were actually fun to participate in?',
    axes: ['internet-culture', 'social', 'tech'],
    values: ['Ice Bucket Challenge', 'Harlem Shake', 'Mannequin Challenge', 'Planking', 'The Dress (Blue/Black vs White/Gold)', 'Bottle Cap Challenge', 'Wordle', 'Sea Shanties', 'Twitch Plays Pokémon', 'Brat Summer'],
    isAbstract: true
  },
  {
    schemaVersion: 1,
    groupSlug: 'creators',
    entityTypeSlug: 'tiktok-audio',
    title: 'Favorite TikTok Audios',
    prompt: 'What are the catchiest TikTok audios?',
    axes: ['internet-culture', 'music', 'social'],
    values: ['Oh No', 'Into The Thick Of It', 'Chrissy Wake Up', 'Jiggle Jiggle', 'It\'s Corn', 'Aesthetic', 'Spongebob Theme', 'Gimme More', 'Say So', 'Renegade'],
    isAbstract: true
  },
  {
    schemaVersion: 1,
    groupSlug: 'gaming',
    entityTypeSlug: 'emote',
    title: 'Favorite Twitch Emotes',
    prompt: 'What are your most used Twitch emotes?',
    axes: ['internet-culture', 'gaming', 'social'],
    values: ['Kappa', 'PogChamp', 'MonkaS', 'KEKW', 'LUL', 'PepeHands', 'TriHard', 'BibleThump', 'Sadge', 'Kreygasm'],
    isAbstract: true
  },
  {
    schemaVersion: 1,
    groupSlug: 'creators',
    entityTypeSlug: 'reaction-gif',
    title: 'Favorite Reaction GIFs',
    prompt: 'Which reaction GIFs do you use the most?',
    axes: ['internet-culture', 'communication', 'comedy'],
    values: ['Michael Jackson Eating Popcorn', 'Homer Backing Into Hedge', 'This Is Fine Dog', 'Blinking White Guy', 'Math Lady / Nazaré', 'Kermit Sipping Tea', 'Disappointed Cricket Fan', 'Elmo on Fire', 'Leonardo DiCaprio Toast', 'Confused Travolta'],
    isAbstract: true
  },
  {
    schemaVersion: 1,
    groupSlug: 'lifestyle-hobbies',
    entityTypeSlug: 'slang',
    title: 'Favorite Internet Slang',
    prompt: 'What internet slang terms do you use ironically (or unironically)?',
    axes: ['internet-culture', 'language', 'social'],
    values: ['Based', 'Cringe', 'Rizz', 'Cap / No Cap', 'Bet', 'Slay', 'Sus', 'Yeet', 'Stan', 'Skibidi'],
    isAbstract: true
  },
  {
    schemaVersion: 1,
    groupSlug: 'entertainment',
    entityTypeSlug: 'viral-video',
    title: 'Favorite Viral Videos',
    prompt: 'What are the best early internet viral videos?',
    axes: ['internet-culture', 'nostalgia', 'video'],
    values: ['Charlie Bit My Finger', 'David After Dentist', 'Numa Numa', 'Star Wars Kid', 'Chocolate Rain', 'Leave Britney Alone', 'Sneezing Panda', 'Keyboard Cat', 'Double Rainbow', 'Evolution of Dance'],
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
