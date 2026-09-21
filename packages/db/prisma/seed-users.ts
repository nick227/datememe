import { db } from '../src/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function main() {
  console.log('Seeding users...')
  const hash = await bcrypt.hash('password123', 12)

  async function upsertDemoUser(
    email: string,
    username: string,
    displayName: string,
    birthYear: number,
    bio: string,
    photoUrls: string[],
    role: 'USER' | 'ADMIN' | 'MODERATOR' = 'USER',
  ) {
    return db.user.upsert({
      where: { email },
      update: { role },
      create: {
        email,
        passwordHash: hash,
        role,
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
  }

  const admin = await upsertDemoUser(
    'admin@datememe.com', 'admin', 'Admin', 1990, 'Here to keep things running smoothly.',
    ['https://picsum.photos/seed/admin-1/800/1000'], 'ADMIN'
  )

  const premiumUser = await upsertDemoUser(
    'premium@example.com', 'chad_premium', 'Chad', 1995, 'Always at the gym or trying a new meal prep.',
    ['https://picsum.photos/seed/chad-1/800/1000', 'https://picsum.photos/seed/chad-2/800/1000']
  )

  const freeUser = await upsertDemoUser(
    'free@example.com', 'alice_free', 'Alice', 1997, 'Pop music enthusiast and amateur baker.',
    ['https://picsum.photos/seed/alice-3/800/1000']
  )

  const bob = await upsertDemoUser(
    'bob@example.com', 'bob_bro', 'Bob', 1994, 'Sports and gains.',
    ['https://picsum.photos/seed/bob-1/800/1000']
  )
  const emma = await upsertDemoUser(
    'emma@example.com', 'emma_cozy', 'Emma', 1996, 'Books, games, and cozy vibes.',
    ['https://picsum.photos/seed/emma-1/800/1000']
  )
  const david = await upsertDemoUser(
    'david@example.com', 'david_scifi', 'David', 1992, 'Sci-Fi nerd and tabletop enthusiast.',
    ['https://picsum.photos/seed/david-1/800/1000']
  )
  const sarah = await upsertDemoUser(
    'sarah@example.com', 'sarah_sports', 'Sarah', 1995, 'Die-hard sports fan.',
    ['https://picsum.photos/seed/sarah-1/800/1000']
  )

  // Give premiumUser a subscription
  const plan = await db.plan.findUnique({ where: { slug: 'premium-monthly' } })
  if (plan) {
    await db.subscription.upsert({
      where: { providerSubscriptionId: 'seed-sub-premium' },
      update: {},
      create: {
        userId: premiumUser.id,
        planId: plan.id,
        provider: 'STRIPE',
        providerSubscriptionId: 'seed-sub-premium',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }
    })
  }

  async function setList(profileId: string, categorySlug: string, entityNames: string[], entityTypeId: string) {
    const category = await db.category.findUnique({ where: { slug: categorySlug } })
    if (!category) return;
    const list = await db.list.upsert({
      where: { profileId_categoryId: { profileId, categoryId: category.id } },
      update: {},
      create: { profileId, categoryId: category.id, isComplete: true, completedAt: new Date() },
    })
    for (let i = 0; i < entityNames.length; i++) {
      const slug = slugify(entityNames[i]!)
      const entity = await db.entity.findUnique({ where: { entityTypeId_slug: { entityTypeId, slug } } })
      if (!entity) continue;
      const existing = await db.listItem.findUnique({ where: { listId_rank: { listId: list.id, rank: i + 1 } } })
      await db.listItem.upsert({
        where: { listId_rank: { listId: list.id, rank: i + 1 } },
        update: { entityId: entity.id },
        create: { listId: list.id, entityId: entity.id, rank: i + 1 },
      })
      if (!existing) {
        await db.entity.update({ where: { id: entity.id }, data: { usageCount: { increment: 1 } } })
      }
    }
  }

  const gymChainId = (await db.entityType.findUnique({where:{slug:'gym-chain'}}))?.id
  const groceryId = (await db.entityType.findUnique({where:{slug:'grocery-store'}}))?.id
  const bandId = (await db.entityType.findUnique({where:{slug:'band'}}))?.id
  const athleteId = (await db.entityType.findUnique({where:{slug:'athlete'}}))?.id
  const podcastId = (await db.entityType.findUnique({where:{slug:'podcast'}}))?.id
  const bookId = (await db.entityType.findUnique({where:{slug:'book'}}))?.id
  const boardGameId = (await db.entityType.findUnique({where:{slug:'board-game'}}))?.id
  const sportsTeamId = (await db.entityType.findUnique({where:{slug:'sports-team'}}))?.id

  async function setCompatibility(pA: string, pB: string, score: number, sharedItemsCount: number, sharedFavorites: any[], insights: any[]) {
    const [idA, idB] = [pA, pB].sort()
    await db.compatibilityScore.upsert({
      where: { profileIdA_profileIdB: { profileIdA: idA!, profileIdB: idB! } },
      update: { score, sharedItemsCount, sharedFavorites, insights },
      create: { profileIdA: idA!, profileIdB: idB!, score, sharedItemsCount, sharedFavorites, insights },
    })
  }

  if (premiumUser.profile && freeUser.profile && gymChainId && groceryId && bandId) {
    // Premium lists (triggering active/fitness and foodie insights)
    await setList(premiumUser.profile.id, 'favorite-gym-chain', ['Equinox'], gymChainId)
    await setList(premiumUser.profile.id, 'favorite-grocery-store', ['Whole Foods', 'Trader Joe\'s'], groceryId)
    await setList(premiumUser.profile.id, 'top-hiphop-artists', ['Drake', 'Kendrick Lamar'], bandId)

    // Free lists (triggering pop-culture, extrovert)
    await setList(freeUser.profile.id, 'top-pop-artists', ['Taylor Swift', 'Dua Lipa'], bandId)
    await setList(freeUser.profile.id, 'top-90s-bands', ['Nirvana', 'Radiohead'], bandId)

    // Bob
    if (athleteId && podcastId) {
      await setList(bob.profile!.id, 'top-athletes', ['LeBron James', 'Lionel Messi'], athleteId)
      await setList(bob.profile!.id, 'top-podcasts', ['The Joe Rogan Experience', 'Huberman Lab'], podcastId)
      await setList(bob.profile!.id, 'favorite-gym-chain', ['Equinox'], gymChainId)
      await setList(bob.profile!.id, 'top-hiphop-artists', ['Drake'], bandId)
    }

    // Emma
    if (bookId && boardGameId) {
      await setList(emma.profile!.id, 'favorite-books', ['Pride and Prejudice', 'The Hobbit'], bookId)
      await setList(emma.profile!.id, 'favorite-board-games', ['Catan', 'Ticket to Ride'], boardGameId)
      await setList(emma.profile!.id, 'top-pop-artists', ['Taylor Swift'], bandId)
      await setList(emma.profile!.id, 'favorite-grocery-store', ['Trader Joe\'s'], groceryId)
    }

    // David
    if (bookId && boardGameId) {
      await setList(david.profile!.id, 'favorite-scifi-books', ['Dune', '1984'], bookId)
      await setList(david.profile!.id, 'favorite-board-games', ['Dungeons & Dragons'], boardGameId)
      await setList(david.profile!.id, 'top-90s-bands', ['Radiohead'], bandId)
      await setList(david.profile!.id, 'top-hiphop-artists', ['Kendrick Lamar'], bandId)
    }

    // Sarah
    if (sportsTeamId) {
      await setList(sarah.profile!.id, 'favorite-sports-teams', ['Los Angeles Lakers', 'Real Madrid'], sportsTeamId)
      await setList(sarah.profile!.id, 'favorite-gym-chain', ['Equinox'], gymChainId)
      await setList(sarah.profile!.id, 'top-pop-artists', ['Dua Lipa'], bandId)
    }

    async function addSwipe(actor: string, target: string, action: 'LIKE'|'PASS' = 'LIKE') {
      await db.swipe.upsert({
        where: { actorProfileId_targetProfileId: { actorProfileId: actor, targetProfileId: target } },
        update: { action },
        create: { actorProfileId: actor, targetProfileId: target, action },
      })
    }

    // Swipes
    await addSwipe(premiumUser.profile.id, freeUser.profile.id)
    await addSwipe(freeUser.profile.id, premiumUser.profile.id)
    await addSwipe(premiumUser.profile.id, bob.profile!.id)
    await addSwipe(freeUser.profile.id, emma.profile!.id)
    await addSwipe(david.profile!.id, freeUser.profile.id)
    await addSwipe(david.profile!.id, emma.profile!.id)
    await addSwipe(sarah.profile!.id, premiumUser.profile.id)
    await addSwipe(sarah.profile!.id, bob.profile!.id)

    // Compatibility Scores
    await setCompatibility(premiumUser.profile.id, freeUser.profile.id, 85, 0, [], [])
    await setCompatibility(premiumUser.profile.id, bob.profile!.id, 92, 2, [{ entityName: 'Equinox' }, { entityName: 'Drake' }], [])
    await setCompatibility(freeUser.profile.id, emma.profile!.id, 88, 1, [{ entityName: 'Taylor Swift' }], [])
    await setCompatibility(premiumUser.profile.id, emma.profile!.id, 40, 1, [{ entityName: 'Trader Joe\'s' }], [])
    await setCompatibility(freeUser.profile.id, david.profile!.id, 75, 1, [{ entityName: 'Radiohead' }], [])
    await setCompatibility(premiumUser.profile.id, david.profile!.id, 80, 1, [{ entityName: 'Kendrick Lamar' }], [])
    await setCompatibility(premiumUser.profile.id, sarah.profile!.id, 95, 1, [{ entityName: 'Equinox' }], [])
    await setCompatibility(bob.profile!.id, sarah.profile!.id, 90, 1, [{ entityName: 'Equinox' }], [])
    await setCompatibility(freeUser.profile.id, sarah.profile!.id, 70, 1, [{ entityName: 'Dua Lipa' }], [])

    // Conversation
    const conversation = await db.conversation.upsert({
      where: { id: 'demo-conversation-chad-alice' },
      update: {},
      create: {
        id: 'demo-conversation-chad-alice',
        status: 'ACCEPTED',
        initiatedById: premiumUser.profile.id,
        participants: {
          create: [{ profileId: premiumUser.profile.id }, { profileId: freeUser.profile.id }],
        },
      },
    })
    await db.message.upsert({
      where: { id: 'demo-message-chad-1' },
      update: {},
      create: {
        id: 'demo-message-chad-1',
        conversationId: conversation.id,
        senderId: premiumUser.profile.id,
        body: "Hey Alice, I noticed you're a big Taylor Swift fan. Did you go to the Eras tour?",
      },
    })
    await db.message.upsert({
      where: { id: 'demo-message-alice-1' },
      update: {},
      create: {
        id: 'demo-message-alice-1',
        conversationId: conversation.id,
        senderId: freeUser.profile.id,
        body: "Yes! It was amazing. I see you're an Equinox regular, trying to make me feel bad? 😂",
      },
    })
  }

  console.log(`✓ Users created: Admin (${admin.email}), Premium (${premiumUser.email}), Free (${freeUser.email}), Bob (${bob.email}), Emma (${emma.email}), David (${david.email}), Sarah (${sarah.email})`)
  console.log('User Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
