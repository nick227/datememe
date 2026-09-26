import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const categories = [
    'favorite-sports-teams', 'top-athletes', 'favorite-books', 'favorite-scifi-books', 'favorite-board-games', 'top-sitcoms', 'favorite-national-parks', 'favorite-movie-directors', 'favorite-video-games', 'top-tv-shows'
  ];

  const cats = await db.category.findMany({
    where: { slug: { in: categories } },
    include: { entityType: true }
  });

  const types = cats.map(c => c.entityType.slug);

  const entities = await db.entity.findMany({
    where: { entityType: { slug: { in: types } } },
    include: { entityType: true, mediaAssets: { where: { isPrimary: true } } }
  });

  for (const cat of categories) {
    const c = cats.find(c => c.slug === cat);
    if (!c) continue;
    
    const ents = entities.filter(e => e.entityTypeId === c.entityTypeId);
    const withMedia = ents.filter(e => e.imageUrl || e.mediaAssets.length > 0).map(e => e.canonicalName);
    const withoutMedia = ents.filter(e => !e.imageUrl && e.mediaAssets.length === 0).map(e => e.canonicalName);
    
    console.log(`\n--- ${cat} ---`);
    console.log(`WITH MEDIA (${withMedia.length}):`, withMedia.join(', '));
    console.log(`WITHOUT MEDIA (${withoutMedia.length}):`, withoutMedia.join(', '));
  }
}

main().catch(console.error).finally(() => db.$disconnect());
