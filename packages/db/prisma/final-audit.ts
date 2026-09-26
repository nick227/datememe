import { db } from '../src/client'

async function runAudit() {
  const categories = await db.category.findMany({
    include: {
      entityType: true,
    }
  })

  let allOk = true

  console.log("--- Category Status (Min 8 items) ---")
  for (const cat of categories) {
    if (!cat.isActive) continue

    const entities = await db.entity.count({
      where: { entityTypeId: cat.entityTypeId }
    })
    
    // Check how many have media
    const entitiesWithMedia = await db.entity.count({
      where: {
        entityTypeId: cat.entityTypeId,
        mediaAssets: { some: { isPrimary: true } }
      }
    })

    if (entities >= 8) {
      console.log(`✅ OK: ${cat.slug} (Content: ${entities}, Media: ${entitiesWithMedia})`)
    } else {
      console.log(`❌ FAILED: ${cat.slug} (Content: ${entities}, Media: ${entitiesWithMedia})`)
      allOk = false
    }
  }

  // Check duplicate images
  console.log("\n--- Media Duplicates ---")
  const media = await db.mediaAsset.findMany({ where: { isPrimary: true } })
  const hashes = new Map()
  let hasDuplicates = false
  for (const m of media) {
    if (m.sha256) {
      if (hashes.has(m.sha256)) {
        console.log(`❌ Duplicate image found: ${m.sha256} for entity ${m.entityId} (already used for ${hashes.get(m.sha256)})`)
        hasDuplicates = true
      } else {
        hashes.set(m.sha256, m.entityId)
      }
    }
  }
  if (!hasDuplicates) console.log("✅ No duplicate primary images found.")

  // Check Seeded users & answers
  console.log("\n--- Seeded Users ---")
  const users = await db.user.count()
  console.log(`Total users: ${users}`)
  const lists = await db.list.count()
  console.log(`Total lists: ${lists}`)
  
  if (lists > users * 3) {
    console.log("✅ Seeded users have good participation.")
  } else {
    console.log("❌ Participation might be low.")
  }

  // Check Matches
  console.log("\n--- Discover Matches ---")
  const scores = await db.compatibilityScore.count()
  console.log(`Total matches generated: ${scores}`)
  if (scores > 10) {
    console.log("✅ Matches generated successfully.")
  } else {
    console.log("❌ Not enough matches generated.")
  }
}

runAudit().catch(console.error).finally(() => process.exit(0))
