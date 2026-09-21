import { db } from '@project/db';

async function seedCars() {
  console.log('Seeding Cars taxonomy...');

  // Ensure default group
  let group = await db.categoryGroup.findFirst({ where: { slug: 'default' } });
  if (!group) {
    group = await db.categoryGroup.create({
      data: { slug: 'default', label: 'Default Group', sortOrder: 0 }
    });
  }

  // 1. Create Types (Vehicle -> Manufacturer -> Model)
  const vehicleType = await db.entityType.upsert({
    where: { slug: 'vehicle' },
    update: { isActive: true },
    create: { slug: 'vehicle', label: 'Vehicle', pluralLabel: 'Vehicles', isActive: true }
  });

  const manufacturerType = await db.entityType.upsert({
    where: { slug: 'manufacturer' },
    update: { parentId: vehicleType.id, isActive: true },
    create: { slug: 'manufacturer', label: 'Manufacturer', pluralLabel: 'Manufacturers', parentId: vehicleType.id, isActive: true }
  });

  const modelType = await db.entityType.upsert({
    where: { slug: 'car-model' },
    update: { parentId: manufacturerType.id, isActive: true },
    create: { slug: 'car-model', label: 'Car Model', pluralLabel: 'Car Models', parentId: manufacturerType.id, isActive: true }
  });

  // 2. Create Manufacturers
  const honda = await db.entity.create({
    data: { entityTypeId: manufacturerType.id, canonicalName: 'Honda', slug: 'honda', status: 'APPROVED' }
  });
  const porsche = await db.entity.create({
    data: { entityTypeId: manufacturerType.id, canonicalName: 'Porsche', slug: 'porsche', status: 'APPROVED' }
  });
  const toyota = await db.entity.create({
    data: { entityTypeId: manufacturerType.id, canonicalName: 'Toyota', slug: 'toyota', status: 'APPROVED' }
  });

  // 3. Create Models
  // Honda Models
  const civic = await db.entity.create({ data: { entityTypeId: modelType.id, canonicalName: 'Civic', slug: 'civic', parentId: honda.id }});
  const accord = await db.entity.create({ data: { entityTypeId: modelType.id, canonicalName: 'Accord', slug: 'accord', parentId: honda.id }});
  const nsx = await db.entity.create({ data: { entityTypeId: modelType.id, canonicalName: 'NSX', slug: 'nsx', parentId: honda.id }});

  // Porsche Models
  const p911 = await db.entity.create({ data: { entityTypeId: modelType.id, canonicalName: '911', slug: '911', parentId: porsche.id }});
  const cayman = await db.entity.create({ data: { entityTypeId: modelType.id, canonicalName: 'Cayman', slug: 'cayman', parentId: porsche.id }});
  const boxster = await db.entity.create({ data: { entityTypeId: modelType.id, canonicalName: 'Boxster', slug: 'boxster', parentId: porsche.id }});

  // Toyota Models
  const supra = await db.entity.create({ data: { entityTypeId: modelType.id, canonicalName: 'Supra', slug: 'supra', parentId: toyota.id }});

  // 4. Create Lists (Categories)

  // List 1: Top Honda Models (Constrained to Honda parent)
  const list1 = await db.category.create({
    data: {
      groupId: group.id,
      entityTypeId: modelType.id,
      parentEntityId: honda.id,
      slug: 'top-honda-models',
      shortLabel: 'Top Honda Models',
      prompt: 'Rank your favorite Honda models',
      minItems: 1, maxItems: 3,
      orderingMode: 'RANKED',
      isActive: true
    }
  });

  // Curate some specific Honda models
  await db.categoryEntity.createMany({
    data: [
      { categoryId: list1.id, entityId: civic.id, sortOrder: 0 },
      { categoryId: list1.id, entityId: nsx.id, sortOrder: 1 },
      { categoryId: list1.id, entityId: accord.id, sortOrder: 2 },
    ]
  });

  // List 2: Best 90s Sports Cars (Cross-parent curation)
  const list2 = await db.category.create({
    data: {
      groupId: group.id,
      entityTypeId: modelType.id,
      parentEntityId: null, // Any manufacturer
      slug: 'best-90s-sports-cars',
      shortLabel: 'Best 90s Sports Cars',
      prompt: 'Rank the greatest sports cars of the 90s',
      minItems: 1, maxItems: 3,
      orderingMode: 'RANKED',
      isActive: true
    }
  });

  // Curate mixed models
  await db.categoryEntity.createMany({
    data: [
      { categoryId: list2.id, entityId: nsx.id, sortOrder: 0 },
      { categoryId: list2.id, entityId: p911.id, sortOrder: 1 },
      { categoryId: list2.id, entityId: supra.id, sortOrder: 2 },
    ]
  });

  console.log('Successfully seeded Cars taxonomy and overlapping lists!');
}

seedCars().catch(console.error).finally(() => process.exit(0));
