import { db } from '@project/db'

// Maps CategoryGroup slug to SitePickGroup slug
const GROUP_MAPPINGS: Record<string, string> = {
  'entertainment': 'film-tv',
  'film-tv': 'film-tv',
  'music': 'music',
  'food-drink': 'food',
  'food': 'food',
  'lifestyle-hobbies': 'craft',
  'lifestyle': 'craft',
  'tech': 'tech',
  'creators': 'creators',
  'gaming': 'gaming',
  'career': 'career',
  'travel': 'travel',
  'sports': 'sports',
  'literature': 'books',
  'books': 'books',
  'craft': 'craft'
}

async function run() {
  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    take: 100, // Look at the 100 most recent categories
    include: { group: true }
  })

  console.log(`Found ${categories.length} recent active categories.`)

  for (const cat of categories) {
    if (!cat.group) continue

    const sitePickSlug = GROUP_MAPPINGS[cat.group.slug]
    if (!sitePickSlug) {
      console.log(`No mapping for category group: ${cat.group.slug}`)
      continue
    }

    const sitePickGroup = await db.sitePickGroup.findUnique({ where: { slug: sitePickSlug } })
    if (!sitePickGroup) {
      console.log(`Site pick group not found: ${sitePickSlug}`)
      continue
    }

    // Check if already in site picks
    const existing = await db.sitePickItem.findUnique({
      where: {
        groupId_categoryId: { groupId: sitePickGroup.id, categoryId: cat.id }
      }
    })
    
    if (!existing) {
      await db.sitePickItem.create({
        data: {
          groupId: sitePickGroup.id,
          categoryId: cat.id,
          sortOrder: 0 // Put at the top!
        }
      })
      console.log(`Added ${cat.slug} to ${sitePickSlug} site picks.`)
    }
  }
}

run().catch(console.error).finally(() => process.exit(0))
