import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('Pruning entities with no primary media asset...');
  
  // Find all entities without a primary media asset
  const entities = await db.entity.findMany({
    where: {
      mediaAssets: { none: { isPrimary: true } }
    }
  });
  
  if (entities.length === 0) {
    console.log('No entities to prune!');
  } else {
    for (const entity of entities) {
      console.log(`Pruning entity: ${entity.canonicalName} (${entity.id})`);
      // Delete relationships first if needed, though Cascade/Restrict might handle it
      await db.entityExternalRef.deleteMany({ where: { entityId: entity.id } });
      await db.listItem.deleteMany({ where: { entityId: entity.id } });
      await db.entity.delete({ where: { id: entity.id } });
    }
    console.log(`Pruned ${entities.length} entities.`);
  }

  // Audit categories
  const categories = await db.category.findMany({
    include: { entityType: true }
  });

  console.log('\n--- Category Status ---');
  for (const category of categories) {
    const itemCount = await db.entity.count({
      where: { entityTypeId: category.entityTypeId }
    });
    
    if (itemCount < 8) {
      console.log(`❌ FAILED: ${category.slug} has only ${itemCount} items (needs 8)`);
    } else {
      console.log(`✅ OK: ${category.slug} has ${itemCount} items`);
    }
  }
}

main().catch(console.error).finally(() => db.$disconnect());
