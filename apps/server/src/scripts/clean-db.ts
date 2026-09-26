import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const staleSlugs = [
    'go-to-hotel-chain',
    'favorite-retail-stores',
    'go-to-programming-language',
    'preferred-airline',
    'favorite-car-brands',
    'ideal-weekend-activity',
    'favorite-horror-movies',
    'favorite-cities',
    'ideal-first-dates',
    'weekend-activities'
  ];

  await db.category.deleteMany({
    where: { slug: { in: staleSlugs } }
  });
  
  console.log('Deleted stale categories.');
}

main().catch(console.error).finally(() => db.$disconnect());
