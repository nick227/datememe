import { db } from '@project/db'

async function main() {
  const nonCurated = await db.category.findMany({
    where: { poolMode: { not: 'CURATED' } },
    select: { id: true, shortLabel: true, poolMode: true }
  })
  console.log('Non-curated lists:', nonCurated)
}

main().catch(console.error).finally(() => db.$disconnect())
