import { db, Prisma } from '@project/db'

export async function profileSocialInsightsRefreshJob(payload: { profileId: string }) {
  const { profileId } = payload
  if (!profileId) {
    throw new Error('profileSocialInsightsRefreshJob requires a profileId')
  }

  const now = new Date()
  const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // 1. Get recent messaging interactions
  const recentMessages = await db.$queryRaw<any[]>`
    SELECT DISTINCT m.senderId 
    FROM Message m
    JOIN ConversationParticipant cp ON m.conversationId = cp.conversationId
    WHERE cp.profileId = ${profileId}
      AND m.senderId != ${profileId}
      AND m.createdAt >= ${periodStart}
  `
  const messagerIds = recentMessages.map(r => r.senderId)

  // Baseline: A random sample of active users, or simply total active users.
  // For MVP, we'll just count how many users exist in total to act as baseline.
  const totalUsersCount = await db.profile.count()

  const sampleSummary = {
    likes: 0,
    passes: 0,
    messages: messagerIds.length,
    matches: 0
  }

  const insightsData: any[] = []

  if (messagerIds.length >= 5) {
    // 2. Compute Category Overlap
    // Which categories has this user completed?
    const userLists = await db.list.findMany({
      where: { profileId, isComplete: true },
      select: { categoryId: true, category: { select: { shortLabel: true } } }
    })

    if (userLists.length > 0) {
      const categoryIds = userLists.map(l => l.categoryId)
      
      // Find how many messagers completed these categories
      const messagerListCounts = await db.$queryRaw<any[]>`
        SELECT categoryId, COUNT(DISTINCT profileId) as count
        FROM List
        WHERE profileId IN (${Prisma.join(messagerIds)})
          AND categoryId IN (${Prisma.join(categoryIds)})
          AND isComplete = true
        GROUP BY categoryId
      `

      // Find how many baseline users completed these categories
      const baselineListCounts = await db.$queryRaw<any[]>`
        SELECT categoryId, COUNT(DISTINCT profileId) as count
        FROM List
        WHERE categoryId IN (${Prisma.join(categoryIds)})
          AND isComplete = true
        GROUP BY categoryId
      `

      for (const userList of userLists) {
        const messagerCount = Number(messagerListCounts.find(r => r.categoryId === userList.categoryId)?.count || 0)
        const baselineCount = Number(baselineListCounts.find(r => r.categoryId === userList.categoryId)?.count || 0)
        
        const observedRate = messagerCount / messagerIds.length
        const baselineRate = totalUsersCount > 0 ? (baselineCount / totalUsersCount) : 0
        
        if (baselineRate > 0 && observedRate > baselineRate) {
          const lift = observedRate / baselineRate
          
          // Only include if lift is significant (e.g. > 1.2x) and observed rate is meaningful
          if (lift >= 1.2 && observedRate >= 0.2) {
            insightsData.push({
              sourceType: 'MESSAGES',
              type: 'CATEGORY_OVER_INDEX',
              subjectId: userList.categoryId,
              label: `${userList.category.shortLabel} overlap`,
              value: `People messaging you were ${lift.toFixed(1)}× more likely to share ${userList.category.shortLabel} favorites.`,
              baselineValue: baselineRate.toFixed(2),
              lift: lift,
              strength: lift / 2, // Arbitrary strength score based on lift
              sampleSize: messagerIds.length,
            })
          }
        }
      }
    }
  }

  // Sort by strongest lift
  insightsData.sort((a, b) => b.lift - a.lift)

  const set = await db.profileInsightSet.create({
    data: {
      profileId,
      window: 'WEEKLY',
      periodStart,
      periodEnd: now,
      sampleSummary,
      deliveryStatus: 'PENDING',
      fingerprint: insightsData.length > 0 ? `messages-cat-${insightsData[0].subjectId}-${insightsData[0].lift.toFixed(1)}` : `empty-${now.getTime()}`,
      insights: {
        create: insightsData.slice(0, 3) // Keep top 3
      }
    },
    include: {
      insights: true
    }
  })

  await emitDigestIfChanged(set.id)
}

async function emitDigestIfChanged(setId: string) {
  const set = await db.profileInsightSet.findUnique({
    where: { id: setId },
    include: { insights: true }
  })

  if (!set || set.deliveryStatus !== 'PENDING') return

  // Minimum Evidence Contract
  const hasEnoughData = set.insights.some(i => i.sampleSize >= 5 && i.strength > 0.5)
  
  // Check fingerprint against the last delivered set to ensure it changed materially
  const lastDelivered = await db.profileInsightSet.findFirst({
    where: { 
      profileId: set.profileId, 
      deliveryStatus: 'DELIVERED' 
    },
    orderBy: { lastDeliveredAt: 'desc' }
  })

  // Cooldown check: max 1 digest per 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const onCooldown = lastDelivered && lastDelivered.lastDeliveredAt && lastDelivered.lastDeliveredAt > sevenDaysAgo

  if (!hasEnoughData || onCooldown || (lastDelivered && lastDelivered.fingerprint === set.fingerprint)) {
    await db.profileInsightSet.update({
      where: { id: set.id },
      data: { deliveryStatus: 'SUPPRESSED' }
    })
    return
  }

  // Deliver the system message transactionally
  await deliverSystemMessage(set.profileId, set)
}

async function deliverSystemMessage(profileId: string, set: any) {
  // 1. Find or create the one persistent SYSTEM conversation for this user
  let systemConversation = await db.conversation.findFirst({
    where: {
      type: 'SYSTEM',
      participants: {
        some: { profileId }
      }
    }
  })

  if (!systemConversation) {
    systemConversation = await db.conversation.create({
      data: {
        type: 'SYSTEM',
        participants: {
          create: [{ profileId }]
        }
      }
    })
  }

  // 2. Draft the rich text body
  const totalInteractions = (set.sampleSummary as any)?.messages || 0
  let body = `Your activity this week\n${totalInteractions} people interacted with your profile\n\n`
  
  for (const insight of set.insights) {
    body += `${insight.label} ↑\n${insight.value}\n\n`
  }

  // 3. Idempotent check & transactional delivery
  await db.$transaction(async (tx) => {
    // Ensure we haven't already created a message for this set (idempotency)
    const existingMessage = await tx.message.findFirst({
      where: {
        conversationId: systemConversation!.id,
        systemMessageType: 'ACTIVITY_DIGEST',
        attachments: { string_contains: set.id } // crude json match to find set.id
      }
    })

    if (existingMessage) {
      return // Already delivered
    }

    const attachments = {
      insightSetId: set.id,
      fingerprint: set.fingerprint,
      cta: {
        label: 'View activity',
        route: 'Activity',
        params: { insightSetId: set.id }
      }
    }

    await tx.message.create({
      data: {
        conversationId: systemConversation!.id,
        systemMessageType: 'ACTIVITY_DIGEST',
        body: body.trim(),
        attachments: attachments as any
      }
    })

    await tx.profileInsightSet.update({
      where: { id: set.id },
      data: { 
        deliveryStatus: 'DELIVERED',
        lastDeliveredAt: new Date()
      }
    })
  })
}
