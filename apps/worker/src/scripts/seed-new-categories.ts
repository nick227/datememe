import { db } from '@project/db'
import { Prisma } from '@project/db'

async function run() {
  // Get or create groups
  const lifestyleGroup = await db.categoryGroup.upsert({
    where: { slug: 'lifestyle-hobbies' },
    update: {},
    create: { slug: 'lifestyle-hobbies', label: 'Lifestyle & Hobbies', sortOrder: 5 }
  })
  
  const foodGroup = await db.categoryGroup.upsert({
    where: { slug: 'food-drink' },
    update: {},
    create: { slug: 'food-drink', label: 'Food & Drink', sortOrder: 3 }
  })
  
  const entertainmentGroup = await db.categoryGroup.upsert({
    where: { slug: 'entertainment' },
    update: {},
    create: { slug: 'entertainment', label: 'Entertainment', sortOrder: 1 }
  })

  const newCategories = [
    {
      group: lifestyleGroup.id,
      entityTypeSlug: 'weekend-vibe',
      entityTypeLabel: 'Weekend Vibe',
      slug: 'ideal-weekend-vibe',
      shortLabel: 'Weekend Vibe',
      prompt: 'What does your ideal weekend look like?',
      axes: ['social', 'lifestyle'],
      entities: ['Night out at a club', 'Quiet night in with movies', 'Hosting a dinner party', 'Camping outdoors', 'Exploring the city', 'Binge-watching shows', 'Working on hobbies', 'Trying a new restaurant', 'Going to a concert', 'Road trip']
    },
    {
      group: foodGroup.id,
      entityTypeSlug: 'comfort-food',
      entityTypeLabel: 'Comfort Food',
      slug: 'favorite-comfort-foods',
      shortLabel: 'Comfort Foods',
      prompt: 'What are your ultimate comfort foods?',
      axes: ['food', 'comfort', 'indulgence'],
      entities: ['Mac and Cheese', 'Pizza', 'Ice Cream', 'Fried Chicken', 'Ramen', 'Grilled Cheese', 'Chocolate', 'Mashed Potatoes', 'Tacos', 'Burgers']
    },
    {
      group: entertainmentGroup.id,
      entityTypeSlug: 'comedian',
      entityTypeLabel: 'Comedian',
      slug: 'favorite-comedians',
      shortLabel: 'Favorite Comedians',
      prompt: 'Who are your favorite comedians?',
      axes: ['humor', 'entertainment'],
      entities: ['Dave Chappelle', 'John Mulaney', 'Ali Wong', 'Bill Burr', 'Trevor Noah', 'Taylor Tomlinson', 'Bo Burnham', 'Kevin Hart', 'Jim Gaffigan', 'Iliza Shlesinger']
    },
    {
      group: lifestyleGroup.id,
      entityTypeSlug: 'interior-design',
      entityTypeLabel: 'Interior Design Style',
      slug: 'interior-design-styles',
      shortLabel: 'Interior Design',
      prompt: 'What is your preferred interior design style?',
      axes: ['aesthetic', 'creative', 'home'],
      entities: ['Mid-Century Modern', 'Minimalist', 'Industrial', 'Bohemian', 'Scandinavian', 'Traditional', 'Rustic', 'Eclectic', 'Modern Farmhouse', 'Coastal']
    },
    {
      group: lifestyleGroup.id,
      entityTypeSlug: 'outdoor-activity',
      entityTypeLabel: 'Outdoor Activity',
      slug: 'favorite-outdoor-activities',
      shortLabel: 'Outdoor Activities',
      prompt: 'What are your favorite ways to spend time outdoors?',
      axes: ['outdoors', 'active', 'lifestyle'],
      entities: ['Hiking', 'Cycling', 'Running', 'Kayaking', 'Rock Climbing', 'Camping', 'Surfing', 'Skiing', 'Fishing', 'Picnicking']
    }
  ]

  for (const nc of newCategories) {
    const et = await db.entityType.upsert({
      where: { slug: nc.entityTypeSlug },
      update: {},
      create: { slug: nc.entityTypeSlug, label: nc.entityTypeLabel, pluralLabel: nc.entityTypeLabel + 's' }
    })

    const cat = await db.category.upsert({
      where: { slug: nc.slug },
      update: { axes: nc.axes },
      create: {
        groupId: nc.group,
        entityTypeId: et.id,
        slug: nc.slug,
        prompt: nc.prompt,
        shortLabel: nc.shortLabel,
        axes: nc.axes,
        minItems: 1,
        maxItems: 5
      }
    })

    for (const e of nc.entities) {
      const eSlug = e.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      await db.entity.upsert({
        where: { entityTypeId_slug: { entityTypeId: et.id, slug: eSlug } },
        update: {},
        create: {
          entityTypeId: et.id,
          canonicalName: e,
          slug: eSlug
        }
      })
    }
    console.log(`Created/Updated Category: ${nc.shortLabel}`)
  }

  // RE-SEED USERS
  const profiles = await db.profile.findMany({
    where: { username: { not: { startsWith: 'synth_' } } }
  })
  
  const allCats = await db.category.findMany({
    where: { isActive: true },
    include: { entityType: { include: { entities: true } } }
  })

  // We want to make sure users touch different axes.
  // We'll give each user 5-10 lists chosen randomly across different axes.
  console.log(`Reseeding ${profiles.length} real profiles with new diverse lists...`)
  
  for (const p of profiles) {
    // Clear old lists (cascade deletes list items)
    await db.list.deleteMany({ where: { profileId: p.id } })
    
    // Pick 8 random categories
    const shuffled = [...allCats].sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, 8)

    for (const cat of selected) {
      const list = await db.list.create({
        data: { profileId: p.id, categoryId: cat.id, isComplete: true, completedAt: new Date() }
      })
      
      const entities = [...cat.entityType.entities].sort(() => 0.5 - Math.random())
      const pickCount = Math.floor(Math.random() * 3) + 3 // 3 to 5 items
      const picks = entities.slice(0, pickCount)

      let rank = 1
      for (const e of picks) {
        await db.listItem.create({
          data: { listId: list.id, entityId: e.id, rank: rank++ }
        })
      }
    }
  }
  
  console.log('Seeded users re-run successfully!')
}

run().catch(console.error).finally(() => process.exit(0))
