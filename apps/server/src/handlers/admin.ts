import type { AuthenticatedRequest } from '../lib/userContext'
import { db, Prisma } from '@project/db'
import { OpenAIService } from '../services/OpenAIService'
import { decodeCursor, encodeCursor, normalizeLimit } from '../lib/pagination'

function coerceStringId(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw { statusCode: 400, message: `${label} is required` }
  }
  return value.trim()
}

function asAuditPayload(value: unknown) {
  if (value === undefined) return undefined
  return value
}

export async function recordAdminAudit(actorUserId: string, actorRole: string, action: string, targetType: string, targetId: string | undefined, beforeValue: unknown, afterValue: unknown, metadata?: unknown) {
  return db.adminAuditEvent.create({
    data: {
      actorUserId,
      actorRole: actorRole as any,
      action,
      targetType,
      targetId: targetId ?? null,
      beforeValue: asAuditPayload(beforeValue) ? (beforeValue as any) : null,
      afterValue: asAuditPayload(afterValue) ? (afterValue as any) : null,
      metadata: metadata ? (metadata as any) : null,
    },
  })
}

export async function getQueueMetrics(request: AuthenticatedRequest, reply: any) {
  const statusCounts = await db.jobQueue.groupBy({
    by: ['status'],
    _count: { id: true }
  })
  const oldestPending = await db.jobQueue.findMany({
    where: { status: 'PENDING' },
    orderBy: { availableAt: 'asc' },
    take: 10
  })
  const latestFailed = await db.jobQueue.findMany({
    where: { status: 'FAILED' },
    orderBy: { updatedAt: 'desc' },
    take: 10
  })
  return reply.send({
    metrics: statusCounts.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id
      return acc
    }, {} as Record<string, number>),
    oldestPending,
    latestFailed
  })
}

// User Handlers
export async function getUsers(request: AuthenticatedRequest, reply: any) {
  const { cursor, limit, search, planId } = request.query ?? {}
  const decodedCursor = cursor ? decodeCursor(cursor) : null
  const normalizedLimit = normalizeLimit(Number(limit ?? 20), 100, 20)

  const where: Prisma.UserWhereInput = {}
  if (search && typeof search === 'string' && search.trim()) {
    const term = search.trim()
    where.OR = [
      { email: { contains: term } },
      { id: term },
      { profile: { is: { displayName: { contains: term } } } },
      { profile: { is: { username: { contains: term } } } },
    ]
  }
  if (planId && typeof planId === 'string' && planId.trim()) {
    where.subscriptions = { some: { planId: planId.trim(), status: 'ACTIVE' } }
  }

  const users = await db.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      role: true,
      isVerified: true,
      suspendedAt: true,
      createdAt: true,
      profile: {
        select: { id: true, username: true, displayName: true }
      }
    },
    take: normalizedLimit + 1,
    skip: decodedCursor ? 1 : 0,
    cursor: decodedCursor ? { id: decodedCursor.id } : undefined,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })

  const hasMore = users.length > normalizedLimit
  const pageItems = hasMore ? users.slice(0, normalizedLimit) : users
  const nextCursor = hasMore && pageItems.length > 0 ? encodeCursor({ createdAt: pageItems[pageItems.length - 1]!.createdAt.toISOString(), id: pageItems[pageItems.length - 1]!.id }) : null

  return reply.send({ users: pageItems, hasMore, nextCursor })
}

export async function getUser(request: AuthenticatedRequest, reply: any) {
  const { id } = request.params
  const userId = coerceStringId(id, 'id')

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      subscriptions: {
        where: { status: 'ACTIVE' },
        include: { plan: true },
        take: 1
      },
    }
  })

  if (!user) {
    throw { statusCode: 404, message: 'User not found' }
  }

  const auditEvents = await db.adminAuditEvent.findMany({
    where: { targetId: userId, targetType: 'user' },
    orderBy: { createdAt: 'desc' },
    include: {
      actor: {
        select: { id: true, email: true }
      }
    }
  })

  return reply.send({ user, auditEvents })
}

export async function banUser(request: AuthenticatedRequest, reply: any) {
  const userId = coerceStringId(request.body?.userId, 'userId')
  const ban = request.body?.ban
  if (typeof ban !== 'boolean') throw { statusCode: 400, message: 'ban must be a boolean' }
  const targetUser = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, suspendedAt: true } })
  if (!targetUser) throw { statusCode: 404, message: 'User not found' }
  if (targetUser.id === request.user.id) throw { statusCode: 400, message: 'You cannot ban your own account' }

  const before = { suspendedAt: targetUser.suspendedAt }
  const updatedUser = await db.user.update({
    where: { id: userId },
    data: { suspendedAt: ban ? new Date() : null }
  })
  await recordAdminAudit(request.user.id, request.user.role, 'ban_user', 'user', userId, before, { suspendedAt: updatedUser.suspendedAt }, { action: ban ? 'ban' : 'unban' })
  return reply.send({ user: updatedUser })
}

export async function verifyUser(request: AuthenticatedRequest, reply: any) {
  const userId = coerceStringId(request.body?.userId, 'userId')
  const verify = request.body?.verify
  if (typeof verify !== 'boolean') throw { statusCode: 400, message: 'verify must be a boolean' }
  const targetUser = await db.user.findUnique({ where: { id: userId }, select: { id: true, isVerified: true } })
  if (!targetUser) throw { statusCode: 404, message: 'User not found' }

  const before = { isVerified: targetUser.isVerified }
  const updatedUser = await db.user.update({
    where: { id: userId },
    data: { isVerified: verify }
  })
  await recordAdminAudit(request.user.id, request.user.role, 'verify_user', 'user', userId, before, { isVerified: updatedUser.isVerified }, { action: verify ? 'verify' : 'unverify' })
  return reply.send({ user: updatedUser })
}

// Plan Handlers
export async function getPlans(request: AuthenticatedRequest, reply: any) {
  const plans = await db.plan.findMany({ 
    orderBy: { priceCents: 'asc' },
    include: {
      _count: {
        select: { subscriptions: { where: { status: 'ACTIVE' } } }
      }
    }
  })
  return reply.send({ plans })
}

export async function updatePlan(request: AuthenticatedRequest, reply: any) {
  const planId = coerceStringId(request.body?.planId, 'planId')
  const priceCents = Number(request.body?.priceCents)
  const isActive = request.body?.isActive
  const features = request.body?.features

  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 1000000) {
    throw { statusCode: 400, message: 'priceCents must be an integer from 0 to 1000000' }
  }

  const plan = await db.plan.findUnique({ 
    where: { id: planId }, 
    select: { id: true, priceCents: true, label: true, isActive: true, features: true, _count: { select: { subscriptions: { where: { status: 'ACTIVE' } } } } } 
  })
  if (!plan) throw { statusCode: 404, message: 'Plan not found' }

  // Prevent silent commercial term changes for grandfathered users
  if (plan._count.subscriptions > 0) {
    if (priceCents !== plan.priceCents) {
      throw { statusCode: 400, message: 'Cannot change price of a plan with active subscriptions. Archive this plan and create a new one.' }
    }
    if (features && JSON.stringify(features) !== JSON.stringify(plan.features)) {
      throw { statusCode: 400, message: 'Cannot change entitlements of a plan with active subscriptions. Archive this plan and create a new one.' }
    }
  }

  const data: any = { priceCents }
  if (typeof isActive === 'boolean') data.isActive = isActive
  if (features) data.features = features

  const updatedPlan = await db.plan.update({
    where: { id: planId },
    data
  })
  
  await recordAdminAudit(
    request.user.id, 
    request.user.role, 
    'update_plan', 
    'plan', 
    planId, 
    { priceCents: plan.priceCents, isActive: plan.isActive, features: plan.features }, 
    { priceCents: updatedPlan.priceCents, isActive: updatedPlan.isActive, features: updatedPlan.features }, 
    { planLabel: plan.label }
  )
  return reply.send({ plan: updatedPlan })
}

export async function createPlan(request: AuthenticatedRequest, reply: any) {
  const { label, slug, interval, priceCents, features, isActive } = request.body ?? {}

  if (typeof label !== 'string' || !label.trim()) throw { statusCode: 400, message: 'label is required' }
  if (typeof slug !== 'string' || !slug.trim()) throw { statusCode: 400, message: 'slug is required' }
  if (!['MONTHLY', 'ANNUAL', 'LIFETIME'].includes(interval)) throw { statusCode: 400, message: 'interval must be MONTHLY, ANNUAL, or LIFETIME' }
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 1000000) {
    throw { statusCode: 400, message: 'priceCents must be an integer from 0 to 1000000' }
  }

  const newPlan = await db.plan.create({
    data: {
      label: label.trim(),
      slug: slug.trim(),
      interval,
      priceCents,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      features: features ?? {}
    }
  })

  await recordAdminAudit(
    request.user.id,
    request.user.role,
    'create_plan',
    'plan',
    newPlan.id,
    null,
    { label: newPlan.label, slug: newPlan.slug, priceCents: newPlan.priceCents, interval: newPlan.interval },
    null
  )
  return reply.send({ plan: newPlan })
}

export async function overrideUserMembership(request: AuthenticatedRequest, reply: any) {
  const userId = coerceStringId(request.body?.userId, 'userId')
  const planId = coerceStringId(request.body?.planId, 'planId')

  const targetUser = await db.user.findUnique({ where: { id: userId }, include: { subscriptions: { where: { status: 'ACTIVE' } } } })
  if (!targetUser) throw { statusCode: 404, message: 'User not found' }
  const plan = await db.plan.findUnique({ where: { id: planId } })
  if (!plan) throw { statusCode: 404, message: 'Plan not found' }

  const existingSubscription = targetUser.subscriptions[0]
  const before = existingSubscription ? { planId: existingSubscription.planId, status: existingSubscription.status } : null

  let subscription
  if (existingSubscription) {
    subscription = await db.subscription.update({
      where: { id: existingSubscription.id },
      data: { planId, provider: 'MANUAL', cancelAtPeriodEnd: false, currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
    })
  } else {
    subscription = await db.subscription.create({
      data: {
        userId,
        planId,
        provider: 'MANUAL',
        providerSubscriptionId: `manual_${Date.now()}_${userId}`,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false
      }
    })
  }

  await recordAdminAudit(request.user.id, request.user.role, 'override_membership', 'user', userId, before, { planId: subscription.planId, status: subscription.status, provider: subscription.provider }, { planLabel: plan.label })
  return reply.send({ subscription })
}

export async function revokeUserMembership(request: AuthenticatedRequest, reply: any) {
  const userId = coerceStringId(request.body?.userId, 'userId')

  const targetUser = await db.user.findUnique({ where: { id: userId }, include: { subscriptions: { where: { status: 'ACTIVE' } } } })
  if (!targetUser) throw { statusCode: 404, message: 'User not found' }

  const existingSubscription = targetUser.subscriptions[0]
  if (!existingSubscription) throw { statusCode: 400, message: 'User has no active membership to revoke' }

  const before = { planId: existingSubscription.planId, status: existingSubscription.status }

  const subscription = await db.subscription.update({
    where: { id: existingSubscription.id },
    data: { status: 'CANCELED', cancelAtPeriodEnd: false, currentPeriodEnd: new Date() }
  })

  await recordAdminAudit(request.user.id, request.user.role, 'revoke_membership', 'user', userId, before, { planId: subscription.planId, status: subscription.status }, null)
  return reply.send({ subscription })
}

// Taxonomy Handlers
export async function getEntityTypes(request: AuthenticatedRequest, reply: any) {
  const entityTypes = await db.entityType.findMany({
    include: {
      children: true,
      mediaAssets: { orderBy: { createdAt: 'desc' } },
    },
    where: {
      parentId: null
    }
  })
  const allTypes = await db.entityType.findMany({ include: { mediaAssets: { orderBy: { createdAt: 'desc' } } } })
  return reply.send({ entityTypes: allTypes })
}

export async function createEntityType(request: AuthenticatedRequest, reply: any) {
  const { slug, label, pluralLabel, parentId, icon } = request.body ?? {}
  if (typeof slug !== 'string' || !slug.trim()) throw { statusCode: 400, message: 'slug is required' }
  if (typeof label !== 'string' || !label.trim()) throw { statusCode: 400, message: 'label is required' }
  if (typeof pluralLabel !== 'string' || !pluralLabel.trim()) throw { statusCode: 400, message: 'pluralLabel is required' }

  if (parentId !== null && parentId !== undefined) {
    const parent = await db.entityType.findUnique({ where: { id: coerceStringId(parentId, 'parentId') } })
    if (!parent) return reply.status(400).send({ error: 'Parent not found' })
  }

  const newType = await db.entityType.create({
    data: { slug: slug.trim(), label: label.trim(), pluralLabel: pluralLabel.trim(), parentId: parentId ? coerceStringId(parentId, 'parentId') : null, icon: typeof icon === 'string' ? icon : null }
  })
  await recordAdminAudit(request.user.id, request.user.role, 'create_entity_type', 'entity_type', newType.id, null, { slug: newType.slug, label: newType.label }, { parentId: newType.parentId })
  return reply.send({ entityType: newType })
}

export async function updateEntityType(request: AuthenticatedRequest, reply: any) {
  const { id } = request.params
  const { slug, label, pluralLabel, parentId, icon } = request.body ?? {}
  const cleanId = coerceStringId(id, 'id')
  const target = await db.entityType.findUnique({ where: { id: cleanId } })
  if (!target) throw { statusCode: 404, message: 'Entity type not found' }

  if (typeof slug !== 'string' || !slug.trim()) throw { statusCode: 400, message: 'slug is required' }
  if (typeof label !== 'string' || !label.trim()) throw { statusCode: 400, message: 'label is required' }
  if (typeof pluralLabel !== 'string' || !pluralLabel.trim()) throw { statusCode: 400, message: 'pluralLabel is required' }

  const nextParentId = parentId === null || parentId === undefined ? null : coerceStringId(parentId, 'parentId')
  if (nextParentId) {
    let currentId: string | null = nextParentId
    const visited = new Set<string>()
    while (currentId) {
      if (currentId === cleanId) {
        return reply.status(400).send({ error: 'Cycle detected: cannot set parent to a descendant.' })
      }
      if (visited.has(currentId)) break
      visited.add(currentId)
      const parentNode: { parentId: string | null } | null = await db.entityType.findUnique({ where: { id: currentId }, select: { parentId: true } })
      currentId = parentNode?.parentId || null
    }
  }

  const isActiveParam = request.body.isActive
  const isActive = typeof isActiveParam === 'boolean' ? isActiveParam : target.isActive

  const updatedType = await db.entityType.update({
    where: { id: cleanId },
    data: { slug: slug.trim(), label: label.trim(), pluralLabel: pluralLabel.trim(), parentId: nextParentId, icon: typeof icon === 'string' ? icon : null, isActive }
  })
  await recordAdminAudit(request.user.id, request.user.role, 'update_entity_type', 'entity_type', cleanId, { slug: target.slug, label: target.label, pluralLabel: target.pluralLabel, parentId: target.parentId }, { slug: updatedType.slug, label: updatedType.label, pluralLabel: updatedType.pluralLabel, parentId: updatedType.parentId }, { icon: !!updatedType.icon })
  return reply.send({ entityType: updatedType })
}

export async function getEntities(request: AuthenticatedRequest, reply: any) {
  const { entityTypeId, parentId } = request.query
  const where: any = {}
  if (entityTypeId) where.entityTypeId = coerceStringId(entityTypeId, 'entityTypeId')
  if (parentId !== undefined) where.parentId = parentId === 'null' ? null : coerceStringId(parentId, 'parentId')

  const entities = await db.entity.findMany({
    where,
    include: {
      children: true,
      mediaAssets: { orderBy: { createdAt: 'desc' } },
      externalRefs: true,
    },
    orderBy: { canonicalName: 'asc' }
  })
  return reply.send({ entities })
}

export async function createEntity(request: AuthenticatedRequest, reply: any) {
  const { entityTypeId, canonicalName, slug, parentId } = request.body
  if (typeof entityTypeId !== 'string' || !entityTypeId.trim()) throw { statusCode: 400, message: 'entityTypeId is required' }
  if (typeof canonicalName !== 'string' || !canonicalName.trim()) throw { statusCode: 400, message: 'canonicalName is required' }
  if (typeof slug !== 'string' || !slug.trim()) throw { statusCode: 400, message: 'slug is required' }

  const nextParentId = parentId === null || parentId === undefined ? null : coerceStringId(parentId, 'parentId')

  // Validate parent conforms
  if (nextParentId) {
    const parentNode = await db.entity.findUnique({ where: { id: nextParentId }, include: { entityType: true } })
    if (!parentNode) return reply.status(404).send({ error: 'Parent entity not found' })
    const typeNode = await db.entityType.findUnique({ where: { id: entityTypeId } })
    if (typeNode?.parentId !== parentNode.entityTypeId) {
      return reply.status(400).send({ error: `Hierarchy violation: Parent entity is of type '${parentNode.entityType.label}', which does not match the expected parent type for this entity.` })
    }
  }

  const created = await db.entity.create({
    data: {
      entityTypeId: entityTypeId.trim(),
      canonicalName: canonicalName.trim(),
      slug: slug.trim(),
      parentId: nextParentId,
      status: 'APPROVED',
      sourceType: 'SEEDED'
    }
  })
  
  await recordAdminAudit(request.user.id, request.user.role, 'create_entity', 'entity', created.id, null, { slug: created.slug, canonicalName: created.canonicalName, parentId: created.parentId })
  return reply.status(201).send({ entity: created })
}

export async function updateEntity(request: AuthenticatedRequest, reply: any) {
  const { id } = request.params
  const { canonicalName, slug, parentId, status } = request.body
  const cleanId = coerceStringId(id, 'id')
  
  const target = await db.entity.findUnique({ where: { id: cleanId } })
  if (!target) throw { statusCode: 404, message: 'Entity not found' }

  if (typeof canonicalName !== 'string' || !canonicalName.trim()) throw { statusCode: 400, message: 'canonicalName is required' }
  if (typeof slug !== 'string' || !slug.trim()) throw { statusCode: 400, message: 'slug is required' }

  const nextParentId = parentId === null || parentId === undefined ? null : coerceStringId(parentId, 'parentId')
  
  // Cycle detection
  if (nextParentId) {
    let currentId: string | null = nextParentId
    const visited = new Set<string>()
    while (currentId) {
      if (currentId === cleanId) return reply.status(400).send({ error: 'Cycle detected: cannot set parent to a descendant.' })
      if (visited.has(currentId)) break
      visited.add(currentId)
      const pNode: { parentId: string | null } | null = await db.entity.findUnique({ where: { id: currentId }, select: { parentId: true } })
      currentId = pNode?.parentId || null
    }

    // Validate parent conforms
    const parentNode = await db.entity.findUnique({ where: { id: nextParentId }, include: { entityType: true } })
    if (!parentNode) return reply.status(404).send({ error: 'Parent entity not found' })
    const typeNode = await db.entityType.findUnique({ where: { id: target.entityTypeId } })
    if (typeNode?.parentId !== parentNode.entityTypeId) {
      return reply.status(400).send({ error: `Hierarchy violation: Parent entity is of type '${parentNode.entityType.label}', which does not match the expected parent type for this entity.` })
    }
  }

  const nextStatus = status ? status : target.status

  const updatedEntity = await db.entity.update({
    where: { id: cleanId },
    data: { canonicalName: canonicalName.trim(), slug: slug.trim(), parentId: nextParentId, status: nextStatus }
  })
  
  await recordAdminAudit(request.user.id, request.user.role, 'update_entity', 'entity', cleanId, { slug: target.slug, canonicalName: target.canonicalName, parentId: target.parentId, status: target.status }, { slug: updatedEntity.slug, canonicalName: updatedEntity.canonicalName, parentId: updatedEntity.parentId, status: updatedEntity.status })
  return reply.send({ entity: updatedEntity })
}


export async function generateEntities(request: AuthenticatedRequest, reply: any) {
  const { categoryName, prompt, count } = request.body ?? {}
  if (typeof categoryName !== 'string' || !categoryName.trim()) throw { statusCode: 400, message: 'categoryName is required' }
  if (typeof prompt !== 'string') throw { statusCode: 400, message: 'prompt must be a string' }
  const safeCount = Number(count ?? 10)
  if (!Number.isInteger(safeCount) || safeCount < 1 || safeCount > 50) throw { statusCode: 400, message: 'count must be an integer between 1 and 50' }

  try {
    const generatedValues = await OpenAIService.generateListValues(categoryName, prompt, safeCount)
    await recordAdminAudit(
      request.user.id,
      request.user.role,
      'generate_taxonomy_candidates',
      'taxonomy',
      categoryName.trim(),
      { requestedCount: safeCount },
      { generatedCount: generatedValues.length },
      {
        entityTypeLabel: categoryName.trim(),
        promptLength: prompt.length,
      },
    )
    return reply.send({ candidates: generatedValues })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to generate values' })
  }
}

export async function bulkSaveEntities(request: AuthenticatedRequest, reply: any) {
  const { entityTypeId, parentId, entities } = request.body ?? {}
  const cleanTypeId = coerceStringId(entityTypeId, 'entityTypeId')
  const cleanParentId = parentId === null || parentId === undefined ? null : coerceStringId(parentId, 'parentId')

  if (!Array.isArray(entities) || entities.length === 0) {
    throw { statusCode: 400, message: 'entities must be a non-empty array' }
  }

  const normalized = entities.map((entry: any) => {
    if (typeof entry !== 'string') {
      throw { statusCode: 400, message: 'Each entity candidate must be a string' }
    }
    const value = entry.trim()
    if (!value) throw { statusCode: 400, message: 'Entity names cannot be empty' }
    return value
  })

  const type = await db.entityType.findUnique({ where: { id: cleanTypeId } })
  if (!type) throw { statusCode: 404, message: 'Entity type not found' }

  if (cleanParentId) {
    const parentEntity = await db.entity.findUnique({ where: { id: cleanParentId } })
    if (!parentEntity) throw { statusCode: 404, message: 'Parent entity not found' }
    if (type.parentId !== parentEntity.entityTypeId) {
      throw { statusCode: 400, message: 'Invalid hierarchy: parent entity does not match expected type' }
    }
  }

  const uniqueEntities = Array.from(new Set(normalized))
  const created = await Promise.all(uniqueEntities.map(async (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    return db.entity.upsert({
      where: {
        entityTypeId_slug: { entityTypeId: cleanTypeId, slug }
      },
      update: {},
      create: {
        entityTypeId: cleanTypeId,
        parentId: cleanParentId,
        canonicalName: name,
        slug,
        sourceType: 'AI_GENERATED',
        status: 'APPROVED'
      }
    })
  }))

  await recordAdminAudit(request.user.id, request.user.role, 'bulk_save_entities', 'entity_type', cleanTypeId, { count: 0 }, { count: created.length }, { parentId: cleanParentId, saved: uniqueEntities.length })
  return reply.send({ success: true, count: created.length, entities: created })
}

