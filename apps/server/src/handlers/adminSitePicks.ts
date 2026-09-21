import { db } from '@project/db'

function coerceStringId(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw { statusCode: 400, message: `${label} is required` }
  }
  return value.trim()
}

export async function getSitePickGroups(request: any, reply: any) {
  const groups = await db.sitePickGroup.findMany({
    include: { items: { include: { category: true }, orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  })
  return reply.send({ groups })
}

export async function createSitePickGroup(request: any, reply: any) {
  const { slug, label, sortOrder, isActive } = request.body

  const created = await db.sitePickGroup.create({
    data: {
      slug: coerceStringId(slug, 'slug'),
      label: coerceStringId(label, 'label'),
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      isActive: typeof isActive === 'boolean' ? isActive : true,
    },
  })

  return reply.status(201).send({ group: created })
}

export async function updateSitePickGroup(request: any, reply: any) {
  const cleanId = coerceStringId(request.params.id, 'id')
  const { slug, label, sortOrder, isActive } = request.body

  const target = await db.sitePickGroup.findUnique({ where: { id: cleanId } })
  if (!target) throw { statusCode: 404, message: 'Site Picks group not found' }

  const updated = await db.sitePickGroup.update({
    where: { id: cleanId },
    data: {
      slug: slug ? coerceStringId(slug, 'slug') : target.slug,
      label: label ? coerceStringId(label, 'label') : target.label,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : target.sortOrder,
      isActive: typeof isActive === 'boolean' ? isActive : target.isActive,
    },
  })

  return reply.send({ group: updated })
}

export async function deleteSitePickGroup(request: any, reply: any) {
  const cleanId = coerceStringId(request.params.id, 'id')
  const target = await db.sitePickGroup.findUnique({ where: { id: cleanId } })
  if (!target) throw { statusCode: 404, message: 'Site Picks group not found' }

  await db.sitePickGroup.delete({ where: { id: cleanId } })
  return reply.status(204).send()
}

export async function updateSitePickGroupItems(request: any, reply: any) {
  const cleanId = coerceStringId(request.params.id, 'id')
  const { items } = request.body

  if (!Array.isArray(items)) {
    return reply.status(400).send({ error: 'items must be an array of objects { categoryId, sortOrder }' })
  }

  const group = await db.sitePickGroup.findUnique({ where: { id: cleanId } })
  if (!group) throw { statusCode: 404, message: 'Site Picks group not found' }

  await db.$transaction(async (tx) => {
    await tx.sitePickItem.deleteMany({ where: { groupId: cleanId } })
    if (items.length > 0) {
      await tx.sitePickItem.createMany({
        data: items.map((item: any, index: number) => ({
          groupId: cleanId,
          categoryId: coerceStringId(item.categoryId, 'categoryId'),
          sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : index,
        })),
      })
    }
  })

  const updatedItems = await db.sitePickItem.findMany({
    where: { groupId: cleanId },
    include: { category: true },
    orderBy: { sortOrder: 'asc' },
  })
  return reply.send({ items: updatedItems })
}
