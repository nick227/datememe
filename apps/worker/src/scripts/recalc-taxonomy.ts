import { db } from '@project/db'

async function run() {
  const categories = await db.category.findMany()
  
  for (const cat of categories) {
    const completedLists = await db.list.count({
      where: { categoryId: cat.id, isComplete: true }
    })
    
    await db.category.update({
      where: { id: cat.id },
      data: { popularityCount: completedLists }
    })
  }

  const entities = await db.entity.findMany()
  for (const ent of entities) {
    const items = await db.listItem.findMany({
      where: { entityId: ent.id, list: { isComplete: true } },
      select: { list: { select: { profileId: true, categoryId: true } } }
    })
    
    const distinctProfilesGlobal = new Set(items.map(item => item.list.profileId)).size
    
    const usageByCategory: Record<string, number> = {}
    const categoryProfiles = new Map<string, Set<string>>()
    for (const item of items) {
      const catId = item.list.categoryId
      if (!categoryProfiles.has(catId)) categoryProfiles.set(catId, new Set())
      categoryProfiles.get(catId)!.add(item.list.profileId)
    }
    for (const [catId, profiles] of categoryProfiles.entries()) {
      usageByCategory[catId] = profiles.size
    }

    await db.$transaction(async (tx) => {
      await tx.entity.update({
        where: { id: ent.id },
        data: { usageCount: distinctProfilesGlobal }
      })
      for (const [catId, count] of Object.entries(usageByCategory)) {
        await tx.entityCategoryStat.upsert({
          where: { entityId_categoryId: { entityId: ent.id, categoryId: catId } },
          update: { usageCount: count },
          create: { entityId: ent.id, categoryId: catId, usageCount: count }
        })
      }
    })
  }
}
run().then(() => process.exit(0)).catch(console.error)
