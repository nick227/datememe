import { db } from '@project/db'

function coerceStringId(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw { statusCode: 400, message: `${label} is required` }
  }
  return value.trim()
}

export async function getListDefinitions(request: any, reply: any) {
  const categories = await db.category.findMany({
    include: {
      group: true,
      entityType: true,
      parentEntity: true,
      mediaAssets: { orderBy: { createdAt: 'desc' } },
      requiredTags: { include: { tag: true } }
    },
    orderBy: [{ group: { sortOrder: 'asc' } }, { shortLabel: 'asc' }]
  })
  return reply.send({ categories })
}

export async function createListDefinition(request: any, reply: any) {
  const { groupId, entityTypeId, parentEntityId, slug, prompt, shortLabel, minItems, maxItems, orderingMode, isMatchSignal, isPremiumOnly, isActive, tags } = request.body

  const created = await db.category.create({
    data: {
      groupId: coerceStringId(groupId, 'groupId'),
      entityTypeId: coerceStringId(entityTypeId, 'entityTypeId'),
      parentEntityId: parentEntityId ? coerceStringId(parentEntityId, 'parentEntityId') : null,
      slug: coerceStringId(slug, 'slug'),
      prompt: coerceStringId(prompt, 'prompt'),
      shortLabel: coerceStringId(shortLabel, 'shortLabel'),
      minItems: typeof minItems === 'number' ? minItems : 1,
      maxItems: typeof maxItems === 'number' ? maxItems : 5,
      orderingMode: orderingMode === 'UNRANKED' ? 'UNRANKED' : 'RANKED',
      isMatchSignal: typeof isMatchSignal === 'boolean' ? isMatchSignal : true,
      isPremiumOnly: typeof isPremiumOnly === 'boolean' ? isPremiumOnly : false,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      requiredTags: Array.isArray(tags) ? {
        create: tags.map((t: string) => ({ tagId: t }))
      } : undefined
    }
  })

  // We should also record an audit event ideally, but skipping for brevity or we can import it if needed.

  return reply.status(201).send({ category: created })
}

export async function updateListDefinition(request: any, reply: any) {
  const cleanId = coerceStringId(request.params.id, 'id')
  const { groupId, entityTypeId, parentEntityId, slug, prompt, shortLabel, minItems, maxItems, orderingMode, isMatchSignal, isPremiumOnly, isActive, tags } = request.body

  const target = await db.category.findUnique({ where: { id: cleanId } })
  if (!target) throw { statusCode: 404, message: 'List Definition not found' }

  // Update primitive fields
  const updated = await db.category.update({
    where: { id: cleanId },
    data: {
      groupId: groupId ? coerceStringId(groupId, 'groupId') : target.groupId,
      entityTypeId: entityTypeId ? coerceStringId(entityTypeId, 'entityTypeId') : target.entityTypeId,
      parentEntityId: parentEntityId !== undefined ? (parentEntityId ? coerceStringId(parentEntityId, 'parentEntityId') : null) : target.parentEntityId,
      slug: slug ? coerceStringId(slug, 'slug') : target.slug,
      prompt: prompt ? coerceStringId(prompt, 'prompt') : target.prompt,
      shortLabel: shortLabel ? coerceStringId(shortLabel, 'shortLabel') : target.shortLabel,
      minItems: typeof minItems === 'number' ? minItems : target.minItems,
      maxItems: typeof maxItems === 'number' ? maxItems : target.maxItems,
      orderingMode: orderingMode ? (orderingMode === 'UNRANKED' ? 'UNRANKED' : 'RANKED') : target.orderingMode,
      isMatchSignal: typeof isMatchSignal === 'boolean' ? isMatchSignal : target.isMatchSignal,
      isPremiumOnly: typeof isPremiumOnly === 'boolean' ? isPremiumOnly : target.isPremiumOnly,
      isActive: typeof isActive === 'boolean' ? isActive : target.isActive,
    }
  })

  // Update tags if provided
  if (Array.isArray(tags)) {
    await db.categoryTag.deleteMany({ where: { categoryId: cleanId } })
    if (tags.length > 0) {
      await db.categoryTag.createMany({
        data: tags.map((t: string) => ({ categoryId: cleanId, tagId: t }))
      })
    }
  }

  return reply.send({ category: updated })
}

export async function getListDefinitionCuratedEntities(request: any, reply: any) {
  const cleanId = coerceStringId(request.params.id, 'id')
  const curated = await db.categoryEntity.findMany({
    where: { categoryId: cleanId },
    include: { entity: true },
    orderBy: { sortOrder: 'asc' }
  })
  return reply.send({ curatedEntities: curated })
}

export async function updateListDefinitionCuratedEntities(request: any, reply: any) {
  const cleanId = coerceStringId(request.params.id, 'id')
  const { entities } = request.body

  if (!Array.isArray(entities)) {
    return reply.status(400).send({ error: 'entities must be an array of objects { entityId, sortOrder }' })
  }

  // Transaction to replace curated entities
  await db.$transaction(async (tx) => {
    await tx.categoryEntity.deleteMany({ where: { categoryId: cleanId } })
    if (entities.length > 0) {
      await tx.categoryEntity.createMany({
        data: entities.map((e: any, index: number) => ({
          categoryId: cleanId,
          entityId: coerceStringId(e.entityId, 'entityId'),
          sortOrder: typeof e.sortOrder === 'number' ? e.sortOrder : index
        }))
      })
    }
  })

  const curated = await db.categoryEntity.findMany({
    where: { categoryId: cleanId },
    include: { entity: true },
    orderBy: { sortOrder: 'asc' }
  })
  return reply.send({ curatedEntities: curated })
}
