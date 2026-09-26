import { db } from '@project/db'

async function main() {
  const categories = await db.category.findMany({
    include: {
      requiredTags: true,
      curatedEntities: true,
      group: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const rows = [];

  for (const category of categories) {
    const matchingEntities = await db.entity.findMany({
      where: {
        entityTypeId: category.entityTypeId,
        status: 'APPROVED',
        mergedIntoId: null,
        ...(category.poolMode === 'CURATED'
          ? { id: { in: category.curatedEntities.map((e) => e.entityId) } }
          : {
              AND: category.requiredTags.map((rt) => ({
                tags: { some: { tagId: rt.tagId } },
              })),
            }),
      },
      include: {
        mediaAssets: {
          where: { isPrimary: true },
        },
      },
    });

    const valuesCount = matchingEntities.length;
    const imagesCount = matchingEntities.filter(
      (e) => e.mediaAssets.length > 0 || e.imageUrl
    ).length;

    const coverAsset = await db.mediaAsset.findFirst({
      where: { categoryId: category.id, isPrimary: true },
    });
    const hasCover = !!coverAsset;

    const userListsCount = await db.list.count({
      where: { categoryId: category.id },
    });

    let status = 'READY';
    if (valuesCount < 5) {
      status = 'REMOVE';
    } else if (imagesCount < valuesCount || !hasCover) {
      status = 'NEEDS_MEDIA';
    } else if (valuesCount < 10) {
      status = 'NEEDS_VALUES';
    }

    rows.push({
      Category: category.shortLabel,
      Values: valuesCount,
      Images: `${imagesCount}/${valuesCount}`,
      Cover: hasCover ? 'yes' : 'no',
      'User Lists': userListsCount,
      Status: status,
    });
  }

  // Print table
  console.log(
    'Category'.padEnd(25) +
      'Values'.padEnd(9) +
      'Images'.padEnd(9) +
      'Cover'.padEnd(8) +
      'User Lists'.padEnd(13) +
      'Status'
  );
  console.log('-'.repeat(75));
  for (const row of rows) {
    console.log(
      row.Category.padEnd(25) +
        String(row.Values).padEnd(9) +
        row.Images.padEnd(9) +
        row.Cover.padEnd(8) +
        String(row['User Lists']).padEnd(13) +
        row.Status
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
