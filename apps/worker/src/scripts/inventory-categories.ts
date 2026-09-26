import { db } from '@project/db'

async function run() {
  const categories = await db.category.findMany({
    where: { isActive: true },
    select: {
      id: true,
      slug: true,
      shortLabel: true,
      axes: true,
      group: { select: { label: true } },
      entityType: { select: { _count: { select: { entities: true } } } }
    },
    orderBy: { group: { sortOrder: 'asc' } }
  })

  console.log('Active Categories Inventory:')
  const byAxis = new Map<string, typeof categories>()
  
  for (const cat of categories) {
    console.log(`- [${cat.group.label}] ${cat.shortLabel} (${cat.slug}) | Axes: ${JSON.stringify(cat.axes)} | Items: ${cat.entityType._count.entities}`)
    
    const axes = (cat.axes as string[]) || ['Uncategorized']
    for (const axis of axes) {
      if (!byAxis.has(axis)) byAxis.set(axis, [])
      byAxis.get(axis)!.push(cat)
    }
  }

  console.log('\nCategories By Axis:')
  for (const [axis, cats] of byAxis.entries()) {
    console.log(`\n### ${axis} (${cats.length})`)
    for (const cat of cats) {
      console.log(`- ${cat.shortLabel} (${cat.entityType._count.entities} items)`)
    }
  }
}

run().catch(console.error).finally(() => process.exit(0))
