import { PrismaClient, type Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Reserved synthetic identities only. Never run seed-users.ts on hosted staging.
const PREFIX = 'staging-qa-v1'
const STAGING_ORIGIN = 'https://qa-server-staging.up.railway.app'
const SEEDED_AT = new Date('2026-09-01T18:00:00.000Z')
const GENDERS = ['MALE', 'FEMALE', 'NON_BINARY']
const CATEGORIES = ['top-movies', 'favorite-books', 'favorite-board-games', 'top-90s-bands', 'top-tv-shows', 'favorite-video-games', 'favorite-authors', 'favorite-cuisines', 'go-to-fast-food', 'dream-travel-destinations', 'favorite-grocery-store', 'go-to-coffee-chain', 'favorite-clothing-brands', 'most-used-social-media'] as const
type CategorySlug = typeof CATEGORIES[number]
type Fixture = {
  key: string
  name: string
  birthdate: string
  gender: string
  bio: string
  location: string
  lat: number
  lng: number
  member: boolean
  picks: Record<CategorySlug, string[]>
}

const FIXTURES: Fixture[] = [
  {
    key: 'alex', name: 'Alex', birthdate: '1996-04-12', gender: 'MALE', member: true,
    bio: 'Weekend lakefront cyclist, ambitious home cook, and enthusiastic board-game host. Always up for a good movie debate.',
    location: 'Chicago, IL · Lakeview', lat: 41.943, lng: -87.655,
    picks: {
      'top-movies': ['Inception', 'Parasite', 'The Dark Knight'],
      'favorite-books': ['Dune', 'The Hobbit', 'The Martian'],
      'favorite-board-games': ['Wingspan', 'Catan', 'Ticket to Ride'],
      'top-90s-bands': ['Radiohead', 'Nirvana', 'Oasis'],
      'top-tv-shows': ['The Bear', 'Succession', 'Severance'],
      'favorite-video-games': ['God of War Ragnarök', 'Elden Ring', 'Ghost of Tsushima'],
      'favorite-authors': ['George R.R. Martin', 'Stephen King', 'J.K. Rowling'],
      'favorite-cuisines': ['Italian', 'Mexican', 'Thai'],
      'go-to-fast-food': ['Sweetgreen', 'Chipotle', 'Shake Shack'],
      'dream-travel-destinations': ['Japan', 'New Zealand', 'Iceland'],
      'favorite-grocery-store': ['Trader Joe\'s', 'Whole Foods'],
      'go-to-coffee-chain': ['Starbucks', 'Peet\'s Coffee'],
      'favorite-clothing-brands': ['Patagonia', 'Carhartt', 'Nike'],
      'most-used-social-media': ['Twitter / X', 'Reddit', 'YouTube'],
    },
  },
  {
    key: 'maya', name: 'Maya', birthdate: '1998-08-23', gender: 'FEMALE', member: true,
    bio: 'Designer by day, bookstore browser by weekend. Looking for someone to share coffee, sci-fi, and a very competitive game night.',
    location: 'Chicago, IL · Lincoln Park', lat: 41.921, lng: -87.651,
    picks: {
      'top-movies': ['Parasite', 'Inception', 'Get Out'],
      'favorite-books': ['Dune', 'The Martian', "The Hitchhiker's Guide to the Galaxy"],
      'favorite-board-games': ['Wingspan', 'Ticket to Ride', 'Carcassonne'],
      'top-90s-bands': ['Radiohead', 'Blur', 'No Doubt'],
      'top-tv-shows': ['White Lotus', 'The Bear', 'Severance'],
      'favorite-video-games': ['Horizon Forbidden West', 'The Last of Us Part I', 'Minecraft'],
      'favorite-authors': ['Jane Austen', 'Agatha Christie', 'J.K. Rowling'],
      'favorite-cuisines': ['Japanese', 'Korean', 'Vietnamese'],
      'go-to-fast-food': ['Cava', 'Sweetgreen', 'In-N-Out'],
      'dream-travel-destinations': ['Italy', 'Spain', 'Greece'],
      'favorite-grocery-store': ['Whole Foods', 'Sprouts', 'H Mart'],
      'go-to-coffee-chain': ['Blue Bottle Coffee', 'Philz Coffee'],
      'favorite-clothing-brands': ['Everlane', 'Zara', 'Uniqlo'],
      'most-used-social-media': ['Instagram', 'Pinterest', 'TikTok'],
    },
  },
  {
    key: 'jordan', name: 'Jordan', birthdate: '1993-02-06', gender: 'NON_BINARY', member: true,
    bio: 'Museum afternoons, neighborhood walks, and fantasy novels. I bring homemade snacks to game night and always read the rules.',
    location: 'Chicago, IL · Logan Square', lat: 41.929, lng: -87.708,
    picks: {
      'top-movies': ['The Dark Knight', 'Pulp Fiction', 'The Godfather'],
      'favorite-books': ['The Hobbit', 'The Lord of the Rings', 'Mistborn'],
      'favorite-board-games': ['Catan', 'Chess', 'Risk'],
      'top-90s-bands': ['Nirvana', 'Pearl Jam', 'Weezer'],
      'top-tv-shows': ['The Sopranos', 'The Wire', 'Breaking Bad'],
      'favorite-video-games': ['The Witcher 3: Wild Hunt', 'Red Dead Redemption 2', 'Grand Theft Auto V'],
      'favorite-authors': ['Fyodor Dostoevsky', 'Leo Tolstoy', 'Charles Dickens'],
      'favorite-cuisines': ['Indian', 'Ethiopian', 'Lebanese'],
      'go-to-fast-food': ['Popeyes', 'Wendy\'s', 'McDonald\'s'],
      'dream-travel-destinations': ['Peru', 'Brazil', 'South Africa'],
      'favorite-grocery-store': ['Aldi', 'Kroger', 'Meijer'],
      'go-to-coffee-chain': ['Dunkin\'', 'Tim Hortons'],
      'favorite-clothing-brands': ['Levi\'s', 'Vans', 'Adidas'],
      'most-used-social-media': ['Reddit', 'Discord', 'YouTube'],
    },
  },
  {
    key: 'sam', name: 'Sam', birthdate: '1999-11-17', gender: 'FEMALE', member: true,
    bio: 'Nurse, horror-movie fan, and amateur gardener. My perfect Sunday starts with a farmers market and ends with a cozy game.',
    location: 'Chicago, IL · Ravenswood', lat: 41.969, lng: -87.675,
    picks: {
      'top-movies': ['Get Out', 'The Shining', 'Hereditary'],
      'favorite-books': ['Foundation', 'Neuromancer', 'Snow Crash'],
      'favorite-board-games': ['Pandemic', 'Carcassonne', 'Wingspan'],
      'top-90s-bands': ['The Smashing Pumpkins', 'Blur', 'Green Day'],
      'top-tv-shows': ['Stranger Things', 'The Office', 'Friends'],
      'favorite-video-games': ['Minecraft', 'Cyberpunk 2077', 'Marvel\'s Spider-Man 2'],
      'favorite-authors': ['Stephen King', 'Agatha Christie', 'Jane Austen'],
      'favorite-cuisines': ['Chinese', 'Thai', 'Mexican'],
      'go-to-fast-food': ['Taco Bell', 'Culver\'s', 'Burger King'],
      'dream-travel-destinations': ['Canada', 'Australia', 'Japan'],
      'favorite-grocery-store': ['Target', 'Publix'],
      'go-to-coffee-chain': ['Caribou Coffee', 'Costa Coffee'],
      'favorite-clothing-brands': ['H&M', 'The North Face'],
      'most-used-social-media': ['Snapchat', 'Instagram', 'TikTok'],
    },
  },
  {
    key: 'casey', name: 'Casey', birthdate: '1989-06-04', gender: 'MALE', member: true,
    bio: 'Architecture enthusiast who knows too many facts about Chicago. In search of a concert buddy and a worthy Catan rival.',
    location: 'Chicago, IL · West Loop', lat: 41.883, lng: -87.648,
    picks: {
      'top-movies': ['Inception', 'The Dark Knight', 'The Godfather'],
      'favorite-books': ['The Martian', 'Dune', 'Foundation'],
      'favorite-board-games': ['Catan', 'Pandemic', 'Ticket to Ride'],
      'top-90s-bands': ['Oasis', 'Weezer', 'Green Day'],
      'top-tv-shows': ['Mad Men', 'Better Call Saul', 'Succession'],
      'favorite-video-games': ['Red Dead Redemption 2', 'Elden Ring', 'Returnal'],
      'favorite-authors': ['Mark Twain', 'Charles Dickens', 'Toni Morrison'],
      'favorite-cuisines': ['French', 'Mediterranean', 'Spanish'],
      'go-to-fast-food': ['Five Guys', 'Shake Shack', 'Chick-fil-A'],
      'dream-travel-destinations': ['Switzerland', 'France', 'Maldives'],
      'favorite-grocery-store': ['Wegmans', 'Costco'],
      'go-to-coffee-chain': ['Pret A Manger', 'Panera Bread'],
      'favorite-clothing-brands': ['Ralph Lauren', 'Gucci', 'Supreme'],
      'most-used-social-media': ['LinkedIn', 'Twitter / X', 'BeReal'],
    },
  },
  {
    key: 'riley', name: 'Riley', birthdate: '1995-09-09', gender: 'FEMALE', member: false,
    bio: 'Teacher, occasional potter, and unapologetic playlist curator. Tell me which book deserves a better film adaptation.',
    location: 'Chicago, IL · Andersonville', lat: 41.979, lng: -87.668,
    picks: {
      'top-movies': ['Parasite', 'Pulp Fiction', 'Get Out'],
      'favorite-books': ['The Hobbit', 'Harry Potter', 'The Name of the Wind'],
      'favorite-board-games': ['Scrabble', 'Ticket to Ride', 'Monopoly'],
      'top-90s-bands': ['Radiohead', 'No Doubt', 'R.E.M.'],
      'top-tv-shows': ['Seinfeld', 'Fargo', 'The Bear'],
      'favorite-video-games': ['Final Fantasy XVI', 'Demon\'s Souls', 'Cyberpunk 2077'],
      'favorite-authors': ['Toni Morrison', 'Jane Austen', 'George R.R. Martin'],
      'favorite-cuisines': ['Greek', 'Peruvian', 'Italian'],
      'go-to-fast-food': ['Subway', 'Waffle House', 'Taco Bell'],
      'dream-travel-destinations': ['Thailand', 'Italy', 'Iceland'],
      'favorite-grocery-store': ['H-E-B', 'Safeway', 'Aldi'],
      'go-to-coffee-chain': ['Dutch Bros', 'Blank Street Coffee'],
      'favorite-clothing-brands': ['Lululemon', 'Nike', 'Patagonia'],
      'most-used-social-media': ['TikTok', 'YouTube', 'Twitch'],
    },
  },
]

const username = (key: string) => `qa_${key}`
const email = (key: string) => `qa-${key}@example.test`
const userId = (key: string) => `${PREFIX}-user-${key}`
const profileId = (key: string) => `${PREFIX}-profile-${key}`
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function readConfig() {
  if (process.env.APP_ENV !== 'staging') throw new Error('APP_ENV must be staging.')
  let url: URL
  try { url = new URL(process.env.DATABASE_URL ?? '') } catch { throw new Error('A staging DATABASE_URL is required.') }
  if (url.protocol !== 'mysql:' || decodeURIComponent(url.pathname) !== '/datememe_staging') {
    throw new Error('Refusing to seed: DATABASE_URL must select the dedicated datememe_staging MySQL database.')
  }
  const password = process.env.QA_SEED_PASSWORD
  if (!password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('QA_SEED_PASSWORD must contain at least 12 characters and at most 72 UTF-8 bytes.')
  }
  let input: unknown = {}
  try { input = JSON.parse(process.env.QA_SEED_MEDIA_URLS ?? '{}') } catch { throw new Error('QA_SEED_MEDIA_URLS must be a JSON object.') }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('QA_SEED_MEDIA_URLS must be a JSON object.')
  const media = new Map<string, string[]>()
  for (const [name, values] of Object.entries(input)) {
    if (!FIXTURES.some((fixture) => username(fixture.key) === name)) throw new Error(`Unknown QA media username: ${name}`)
    if (!Array.isArray(values) || values.length > 6 || values.some((value) => typeof value !== 'string')) {
      throw new Error(`QA media for ${name} must be an array of up to six uploaded image URLs.`)
    }
    if (new Set(values).size !== values.length) throw new Error(`Duplicate QA media for ${name}.`)
    for (const value of values) {
      let mediaUrl: URL
      try { mediaUrl = new URL(value) } catch { throw new Error(`Invalid QA media URL for ${name}.`) }
      if (mediaUrl.origin !== STAGING_ORIGIN || !mediaUrl.pathname.startsWith('/uploads/') || mediaUrl.username || mediaUrl.password || mediaUrl.search || mediaUrl.hash) {
        throw new Error(`QA media for ${name} must use an owned upload under ${STAGING_ORIGIN}/uploads/.`)
      }
    }
    media.set(name, values)
  }
  for (const fixture of FIXTURES) {
    if (fixture.bio.length > 150 || new Date(fixture.birthdate).getUTCFullYear() > 2000) throw new Error(`Invalid adult fixture: ${fixture.key}`)
    for (const picks of Object.values(fixture.picks)) {
      if (picks.length !== 3 || new Set(picks).size !== picks.length) throw new Error(`Invalid ranked picks: ${fixture.key}`)
    }
  }
  return { password, media }
}

async function seed(db: PrismaClient, config: ReturnType<typeof readConfig>) {
  const categories = await db.category.findMany({
    where: { slug: { in: [...CATEGORIES] } },
    include: { requiredTags: true, curatedEntities: true },
  })
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))
  const entities = await db.entity.findMany({
    where: { entityTypeId: { in: categories.map((category) => category.entityTypeId) }, status: 'APPROVED', mergedIntoId: null },
    include: { tags: true },
  })
  const entityByKey = new Map(entities.map((entity) => [`${entity.entityTypeId}:${entity.slug}`, entity]))
  // Fail before any writes if taxonomy is incomplete; never silently seed empty lists.
  for (const fixture of FIXTURES) {
    for (const categorySlug of CATEGORIES) {
      const category = categoryBySlug.get(categorySlug)
      if (!category || !category.isActive || !category.isMatchSignal || category.orderingMode !== 'RANKED' || category.minItems > 3 || category.maxItems < 3) {
        throw new Error(`Missing or incompatible category ${categorySlug}; run the taxonomy seed against staging first.`)
      }
      for (const name of fixture.picks[categorySlug]) {
        const entity = entityByKey.get(`${category.entityTypeId}:${slugify(name)}`)
        if (!entity || category.requiredTags.some((required) => !entity.tags.some((tag) => tag.tagId === required.tagId)) ||
          (category.poolMode === 'CURATED' && !category.curatedEntities.some((item) => item.entityId === entity.id))) {
          throw new Error(`Missing or ineligible ${name} for ${categorySlug}; repair staging taxonomy before seeding.`)
        }
      }
    }
    for (const publicUrl of config.media.get(username(fixture.key)) ?? []) {
      const asset = await db.mediaAsset.findFirst({ where: { publicUrl, sourceType: 'PROFILE_UPLOAD' } })
      if (!asset?.storageKey || (asset.metadata as { ownerUserId?: string } | null)?.ownerUserId !== userId(fixture.key)) {
        throw new Error(`QA photo for ${username(fixture.key)} must first be uploaded through the API as that account.`)
      }
    }
  }

  const passwordHash = await bcrypt.hash(config.password, 12)
  await db.$transaction(async (tx) => {
    const changedCategories = new Set<string>()
    for (const fixture of FIXTURES) {
      const existing = await tx.user.findFirst({ where: { OR: [{ email: email(fixture.key) }, { id: userId(fixture.key) }] }, include: { profile: true } })
      if (existing && (existing.id !== userId(fixture.key) || existing.email !== email(fixture.key) ||
        (existing.profile && existing.profile.id !== profileId(fixture.key)))) {
        throw new Error(`Reserved QA identity collision for ${email(fixture.key)}; refusing to change that account.`)
      }
      await tx.user.upsert({
        where: { id: userId(fixture.key) },
        update: { passwordHash },
        create: { id: userId(fixture.key), email: email(fixture.key), passwordHash, isVerified: true, role: 'USER' },
      })
      await tx.profile.upsert({
        where: { userId: userId(fixture.key) }, update: {},
        create: {
          id: profileId(fixture.key), userId: userId(fixture.key), username: username(fixture.key), displayName: fixture.name,
          birthdate: new Date(`${fixture.birthdate}T12:00:00Z`), genderIdentity: fixture.gender, bio: fixture.bio,
          locationLabel: fixture.location, locationLat: fixture.lat, locationLng: fixture.lng,
          preferredMinAge: 21, preferredMaxAge: 50, isDiscoverable: true, onboardingStep: 4,
          seekingGenders: { create: GENDERS.map((gender) => ({ gender })) },
        },
      })
      const photos = config.media.get(username(fixture.key)) ?? []
      if (photos.length && await tx.profilePhoto.count({ where: { profileId: profileId(fixture.key) } }) === 0) {
        await tx.profilePhoto.createMany({ data: photos.map((url, sortOrder) => ({ id: `${PREFIX}-photo-${fixture.key}-${sortOrder}`, profileId: profileId(fixture.key), url, sortOrder })) })
        await tx.profile.updateMany({ where: { id: profileId(fixture.key), avatarUrl: null }, data: { avatarUrl: photos[0] } })
      }
      if (fixture.member) {
        await tx.membershipGrant.upsert({
          where: { id: `${PREFIX}-grant-${fixture.key}` }, update: {},
          create: {
            id: `${PREFIX}-grant-${fixture.key}`, userId: userId(fixture.key), source: 'MANUAL_ADMIN',
            reason: 'Synthetic staging QA fixture; no purchase or production entitlement.', expiresAt: null,
            entitlementFloor: { 'profile.fullPhotoAccess': true, 'messaging.readIncoming': true, 'messaging.dailySendLimit': 'UNLIMITED', 'lists.memberOnly': true },
          },
        })
      }
      for (const categorySlug of CATEGORIES) {
        const category = categoryBySlug.get(categorySlug)!
        const listExists = await tx.list.findUnique({ where: { profileId_categoryId: { profileId: profileId(fixture.key), categoryId: category.id } } })
        if (listExists) continue // Keep list edits as persistence evidence across deploys/reruns.
        const id = `${PREFIX}-list-${fixture.key}-${categorySlug}`
        await tx.list.create({ data: {
          id, profileId: profileId(fixture.key), categoryId: category.id, visibility: 'PUBLIC', isComplete: true, completedAt: SEEDED_AT,
          items: { create: fixture.picks[categorySlug].map((name, index) => ({
            id: `${id}-${index + 1}`, entityId: entityByKey.get(`${category.entityTypeId}:${slugify(name)}`)!.id, rank: index + 1,
          })) },
        } })
        changedCategories.add(categorySlug)
      }
    }

    for (const [actor, target] of [['alex', 'maya'], ['maya', 'alex'], ['jordan', 'alex'], ['alex', 'riley'], ['riley', 'alex']] as const) {
      await tx.swipe.upsert({
        where: { actorProfileId_targetProfileId: { actorProfileId: profileId(actor), targetProfileId: profileId(target) } }, update: {},
        create: { id: `${PREFIX}-like-${actor}-${target}`, actorProfileId: profileId(actor), targetProfileId: profileId(target), action: 'LIKE' },
      })
    }
    await seedConversation(tx, 'alex', 'maya', [
      ['alex', 'Your Wingspan and Radiohead picks sold me. Coffee and a board-game rematch this weekend?'],
      ['maya', 'Absolutely. I know a cafe near the lake with a big game shelf. Have you tried the Oceania expansion?'],
      ['alex', 'Not yet! Saturday afternoon works for me. I can bring Ticket to Ride too.'],
      ['maya', 'Perfect. Let us compare our movie lists while we wait for coffee.'],
    ])
    await seedConversation(tx, 'alex', 'riley', [
      ['riley', 'I saw The Hobbit on your list. Book first or film first?'],
      ['alex', 'Book first, definitely. What would you add to the next game night?'],
    ])

    // The real worker computes counters, percentages, and feed results from these
    // lists. Deterministic job IDs make reruns safe; no invented compatibility scores.
    const now = Date.now()
    for (const categorySlug of CATEGORIES) {
      const category = categoryBySlug.get(categorySlug)!
      const entityIds = [...new Set(FIXTURES.flatMap((fixture) => fixture.picks[categorySlug].map((name) => entityByKey.get(`${category.entityTypeId}:${slugify(name)}`)!.id)))]
      await enqueue(tx, `${PREFIX}-taxonomy-${categorySlug}`, 'UPDATE_TAXONOMY', { addedEntities: entityIds, removedEntities: [], categoryId: category.id, isCompleteDiff: 0 }, new Date(now), changedCategories.has(categorySlug))
      await enqueue(tx, `${PREFIX}-results-${categorySlug}`, 'LIST_RESULTS_REFRESH', { categoryId: category.id }, new Date(now + 2000), changedCategories.has(categorySlug))
    }
    for (const fixture of FIXTURES) {
      await enqueue(tx, `${PREFIX}-matches-${fixture.key}`, 'CALCULATE_MATCHES', { profileId: profileId(fixture.key) }, new Date(now + 1000), changedCategories.size > 0)
    }
  }, { maxWait: 10_000, timeout: 120_000 })
  console.log(`Seeded ${FIXTURES.length} synthetic staging accounts. Passwords come from QA_SEED_PASSWORD and are not printed.`)
  for (const fixture of FIXTURES) console.log(`${email(fixture.key)} | @${username(fixture.key)} | ${fixture.member ? 'QA member grant' : 'No seed membership grant (free-tier fixture)'}`)
  console.log('Wait for staging-qa-v1-* worker jobs to finish before testing discovery; inspect FAILED jobs before continuing.')
  console.log('Existing profile, list, swipe, and conversation edits are preserved. Missing photos can be attached using QA_SEED_MEDIA_URLS after API uploads.')
}

async function enqueue(tx: Prisma.TransactionClient, id: string, type: string, payload: Prisma.InputJsonObject, availableAt: Date, refresh: boolean) {
  await tx.jobQueue.upsert({ where: { id }, update: {}, create: { id, type, payload, availableAt } })
  // Refresh derived state when a missing list was restored. Never reset a live job.
  await tx.jobQueue.updateMany({
    where: { id, status: { in: refresh ? ['DONE', 'FAILED'] : ['FAILED'] } },
    data: { status: 'PENDING', availableAt, attempts: 0, lockedAt: null, lockedBy: null, finishedAt: null, lastError: null },
  })
}

async function seedConversation(tx: Prisma.TransactionClient, first: string, second: string, messages: Array<[string, string]>) {
  const id = `${PREFIX}-conversation-${first}-${second}`
  await tx.conversation.upsert({
    where: { id }, update: {}, create: {
      id, status: 'ACCEPTED', initiatedById: profileId(first), createdAt: SEEDED_AT,
      participants: { create: [{ profileId: profileId(first), lastReadAt: SEEDED_AT }, { profileId: profileId(second), lastReadAt: SEEDED_AT }] },
    },
  })
  for (const [index, [sender, body]] of messages.entries()) {
    await tx.message.upsert({
      where: { id: `${id}-message-${index + 1}` }, update: {},
      create: { id: `${id}-message-${index + 1}`, conversationId: id, senderId: profileId(sender), body, createdAt: new Date(SEEDED_AT.getTime() + (index + 1) * 60_000) },
    })
  }
}

async function main() {
  const config = readConfig() // Guard before constructing/connecting Prisma.
  if (process.argv.includes('--check')) {
    console.log('Staging environment and six synthetic fixture definitions validated; no database connection made.')
    return
  }
  if (process.argv.slice(2).length) throw new Error('Unsupported argument. Use --check for validation without database access.')
  const db = new PrismaClient()
  try { await seed(db, config) } finally { await db.$disconnect() }
}

main().catch((error: unknown) => {
  // Prisma connection errors may contain infrastructure details; never print URLs or secrets.
  console.error(error instanceof Error && error.name === 'Error' ? error.message : 'Staging seed failed; inspect the database/service configuration without printing credentials.')
  process.exitCode = 1
})
