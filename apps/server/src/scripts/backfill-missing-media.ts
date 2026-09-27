import { db } from '@project/db'
import { TaxonomyMediaService } from '../services/TaxonomyMediaService'
import { wikimediaProvider } from '../services/imageProviders/wikimedia'

async function main() {
  const actor = await db.user.findFirst({ where: { role: 'ADMIN' } })
  if (!actor) throw new Error('No admin user found')

  const mediaService = new TaxonomyMediaService()

  // Find 50 entities without images
  const missingMediaEntities = await db.entity.findMany({
    where: { imageUrl: null },
    take: 50,
    include: { entityType: true }
  })

  console.log(`Found ${missingMediaEntities.length} entities missing media for backfill POC.`)

  for (const entity of missingMediaEntities) {
    console.log(`\nProcessing: ${entity.canonicalName} (${entity.entityType.slug})`)
    try {
      const candidates = await wikimediaProvider.search({ 
        query: entity.canonicalName 
      })
      
      const allowedCandidate = candidates.find(c => c.importRule === 'IMPORT_ALLOWED')
      
      if (allowedCandidate) {
        console.log(`Found candidate: ${allowedCandidate.title} (${allowedCandidate.sourceUrl})`)
        await mediaService.importAndAttach(
          { entityId: entity.id },
          allowedCandidate,
          actor.id,
          actor.role
        )
        console.log(`Successfully attached image to ${entity.canonicalName}`)
      } else {
        console.log(`No IMPORT_ALLOWED candidate found for ${entity.canonicalName}`)
      }
    } catch (e: any) {
      console.error(`Failed to process ${entity.canonicalName}:`, e.message)
    }
    
    // Delay to avoid hitting rate limits on Wikimedia APIs
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
}

main().catch(console.error).finally(() => db.$disconnect())
