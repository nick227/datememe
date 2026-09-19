import { db } from '@project/db'

/**
 * Single seam for the premium-entitlement check (docs/data-schema-proposal.md §8/§9):
 * photo viewing, message receiving, and the message-send cap all read this.
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  const activeSub = await db.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'TRIALING'] },
      currentPeriodEnd: { gt: new Date() },
    },
  })
  return !!activeSub
}

export const FREE_DAILY_MESSAGE_LIMIT = 3

export function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}
