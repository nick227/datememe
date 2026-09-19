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

  // ── Tags ─────────────────────────────────────────────────
  const decade1990s = await upsertTag('decade-1990s', '1990s', 'DECADE')
  const genreAction = await upsertTag('genre-action', 'Action', 'GENRE')
  const genreHorror = await upsertTag('genre-horror', 'Horror', 'GENRE')
  const platformPs5 = await upsertTag('platform-ps5', 'PS5', 'PLATFORM')
  const era19thCentury = await upsertTag('era-19th-century', '19th Century', 'ERA')

  // ── Entities ─────────────────────────────────────────────
  const bands90s = ['Nirvana', 'Oasis', 'Radiohead', 'Pearl Jam', 'The Smashing Pumpkins', 'Blur', 'Weezer', 'No Doubt', 'Green Day', 'R.E.M.']
  for (const name of bands90s) {
    await upsertEntity(band.id, name, { tagIds: [decade1990s.id] })
  }

  const movies = ['Inception', 'The Godfather', 'Pulp Fiction', 'Parasite', 'The Dark Knight', 'Get Out', 'Hereditary', 'The Shining']
  for (const name of movies) {
    const tagIds = ['Get Out', 'Hereditary', 'The Shining'].includes(name) ? [genreHorror.id] : []
    await upsertEntity(movie.id, name, { tagIds })
  }

  const fruits = ['Mango', 'Strawberry', 'Pineapple', 'Blueberry', 'Watermelon', 'Peach', 'Fig', 'Dragonfruit']
  for (const name of fruits) await upsertEntity(fruit.id, name)

  const jobs = ['Software Engineer', 'Marine Biologist', 'Pastry Chef', 'Architect', 'Park Ranger', 'Graphic Designer']
  for (const name of jobs) await upsertEntity(jobTitle.id, name)

  const states = ['Colorado', 'California', 'Vermont', 'Texas', 'Hawaii', 'Montana', 'New York']
  for (const name of states) await upsertEntity(usState.id, name)

  const ides = ['Visual Studio Code', 'JetBrains WebStorm', 'Neovim', 'Xcode', 'Sublime Text', 'Zed']
  for (const name of ides) await upsertEntity(ide.id, name)

  const sewingMachines = ['Singer Heavy Duty 4423', 'Brother CS6000i', 'Janome HD3000', 'Bernina 350']
  for (const name of sewingMachines) await upsertEntity(sewingMachine.id, name)

  const mobileDevices = ['iPhone 15 Pro', 'Samsung Galaxy S24', 'Google Pixel 8', 'iPhone SE']
  for (const name of mobileDevices) await upsertEntity(mobileDevice.id, name)

  const ps5ActionGames = ["Marvel's Spider-Man 2", 'God of War Ragnarök', 'Returnal', 'Ghost of Tsushima', 'Demon\'s Souls']
  for (const name of ps5ActionGames) await upsertEntity(videoGame.id, name, { tagIds: [platformPs5.id, genreAction.id] })

  const youtubers = ['MrBeast', 'Marques Brownlee', 'Emma Chamberlain', 'Kurzgesagt']
  for (const name of youtubers) await upsertEntity(youtuber.id, name)

  const streamers = ['Ninja', 'Pokimane', 'shroud', 'xQc']
  for (const name of streamers) await upsertEntity(twitchStreamer.id, name)

  const authors19th = ['Jane Austen', 'Charles Dickens', 'Mark Twain', 'Fyodor Dostoevsky', 'Emily Brontë']
  for (const name of authors19th) await upsertEntity(author.id, name, { tagIds: [era19thCentury.id] })

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

  // ── Plans ────────────────────────────────────────────────
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

  // ── Demo users ───────────────────────────────────────────
  console.log('Seeding demo users...')
  const hash = await bcrypt.hash('password123', 12)

  async function upsertDemoUser(
    email: string,
    username: string,
    displayName: string,
    birthYear: number,
    bio: string,
    photoUrls: string[],
  ) {
    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: hash,
        profile: {
          create: {
            username,
            displayName,
            birthdate: new Date(`${birthYear}-01-01`),
            bio,
            avatarUrl: photoUrls[0],
            photos: { create: photoUrls.map((url, sortOrder) => ({ url, sortOrder })) },
          },
        },
        sessions: {
          create: { token: randomUUID(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        },
      },
      include: { profile: true },
    })
    return user
  }

  const alice = await upsertDemoUser(
    'alice@example.com',
    'alice',
    'Alice',
    1994,
    'Good coffee, great music, always down for a new adventure.',
    ['https://picsum.photos/seed/alice-1/800/1000', 'https://picsum.photos/seed/alice-2/800/1000'],
  )
  const bob = await upsertDemoUser(
    'bob@example.com',
    'bob',
    'Bob',
    1991,
    'Mango enthusiast. Will talk about 90s bands for hours.',
    ['https://picsum.photos/seed/bob-1/800/1000'],
  )

  async function setList(profileId: string, categorySlug: string, entityNames: string[], entityTypeId: string) {
    const category = await db.category.findUniqueOrThrow({ where: { slug: categorySlug } })
    const list = await db.list.upsert({
      where: { profileId_categoryId: { profileId, categoryId: category.id } },
      update: {},
      create: { profileId, categoryId: category.id, isComplete: true, completedAt: new Date() },
    })
    for (let i = 0; i < entityNames.length; i++) {
      const slug = slugify(entityNames[i]!)
      const entity = await db.entity.findUniqueOrThrow({ where: { entityTypeId_slug: { entityTypeId, slug } } })
      const existing = await db.listItem.findUnique({ where: { listId_rank: { listId: list.id, rank: i + 1 } } })
      await db.listItem.upsert({
        where: { listId_rank: { listId: list.id, rank: i + 1 } },
        update: { entityId: entity.id },
        create: { listId: list.id, entityId: entity.id, rank: i + 1 },
      })
      // Seed writes bypass ListService, so maintain the usageCount counter here too —
      // only on first creation, so re-running the seed stays idempotent.
      if (!existing) {
        await db.entity.update({ where: { id: entity.id }, data: { usageCount: { increment: 1 } } })
      }
    }
  }

  if (alice.profile && bob.profile) {
    await setList(alice.profile.id, 'top-90s-bands', ['Nirvana', 'Radiohead', 'Oasis'], band.id)
    await setList(bob.profile.id, 'top-90s-bands', ['Nirvana', 'Pearl Jam', 'Green Day'], band.id)
    await setList(alice.profile.id, 'top-fruits', ['Mango', 'Fig'], fruit.id)
    await setList(bob.profile.id, 'top-fruits', ['Mango', 'Peach'], fruit.id)
    await setList(alice.profile.id, 'favorite-19th-century-authors', ['Jane Austen', 'Emily Brontë'], author.id)

    // demo match — a Conversation should always be backed by two mutual LIKE swipes
    await db.swipe.upsert({
      where: { actorProfileId_targetProfileId: { actorProfileId: alice.profile.id, targetProfileId: bob.profile.id } },
      update: {},
      create: { actorProfileId: alice.profile.id, targetProfileId: bob.profile.id, action: 'LIKE' },
    })
    await db.swipe.upsert({
      where: { actorProfileId_targetProfileId: { actorProfileId: bob.profile.id, targetProfileId: alice.profile.id } },
      update: {},
      create: { actorProfileId: bob.profile.id, targetProfileId: alice.profile.id, action: 'LIKE' },
    })

    // demo conversation
    const conversation = await db.conversation.upsert({
      where: { id: 'demo-conversation-alice-bob' },
      update: {},
      create: {
        id: 'demo-conversation-alice-bob',
        status: 'ACCEPTED',
        initiatedById: alice.profile.id,
        participants: {
          create: [{ profileId: alice.profile.id }, { profileId: bob.profile.id }],
        },
      },
    })
    await db.message.upsert({
      where: { id: 'demo-message-1' },
      update: {},
      create: {
        id: 'demo-message-1',
        conversationId: conversation.id,
        senderId: alice.profile.id,
        body: "Hey! I see we both love Nirvana and mangoes 🥭",
      },
    })
  }

  console.log(`✓ Users: ${alice.profile?.username}, ${bob.profile?.username}`)
  console.log('Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
