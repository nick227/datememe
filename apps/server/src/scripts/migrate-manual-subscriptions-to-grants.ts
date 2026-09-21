// One-off Phase 7 migration, run once against a real DB:
// 1. Every still-active MANUAL Subscription (the old admin "override
//    membership" mechanism) becomes an equivalent MembershipGrant, and the
//    Subscription itself is canceled — grants are now the only non-billing
//    path to MEMBER, and they never touch Subscription (see
//    handlers/membership.ts). Non-MANUAL subscriptions are untouched.
// 2. Every currently-active subscription (including the ones just replaced
//    above, for a consistent audit trail) gets an entitlementFloor snapshot
//    if it doesn't have one yet, so a future Member Features policy
//    reduction can't silently take away what a real, already-active member
//    was already promised.
// 3. (Phase 7.1) Every currently-active subscription with no pricePaidCents
//    snapshot yet gets backfilled with its plan's *current* priceCents —
//    the best available guess for what it was actually charged, since no
//    per-subscription snapshot existed before this. This is what lets
//    admins reprice a Plan freely going forward without it retroactively
//    changing what an existing subscriber is considered to have paid.
import { db, Prisma } from '@project/db'
import { snapshotMemberFloor } from '../lib/entitlements'

async function main() {
  const floor = (await snapshotMemberFloor()) as any

  const manualSubs = await db.subscription.findMany({ where: { provider: 'MANUAL', status: { in: ['ACTIVE', 'TRIALING'] } } })
  console.log(`Found ${manualSubs.length} active MANUAL subscription(s) to migrate to grants.`)
  for (const sub of manualSubs) {
    await db.$transaction([
      db.membershipGrant.create({
        data: {
          userId: sub.userId,
          source: 'MANUAL_ADMIN',
          reason: 'Migrated from legacy MANUAL subscription override (Phase 7)',
          expiresAt: sub.currentPeriodEnd,
          entitlementFloor: floor,
        },
      }),
      db.subscription.update({ where: { id: sub.id }, data: { status: 'CANCELED', cancelAtPeriodEnd: false } }),
    ])
    console.log(`  migrated subscription ${sub.id} (user ${sub.userId}) -> grant, subscription canceled`)
  }

  const unflooredActive = await db.subscription.findMany({
    where: { status: { in: ['ACTIVE', 'TRIALING'] }, entitlementFloor: { equals: Prisma.DbNull } },
  })
  console.log(`Backfilling entitlementFloor on ${unflooredActive.length} active subscription(s) with no floor yet.`)
  for (const sub of unflooredActive) {
    await db.subscription.update({ where: { id: sub.id }, data: { entitlementFloor: floor } })
  }

  const unpricedActive = await db.subscription.findMany({
    where: { status: { in: ['ACTIVE', 'TRIALING'] }, pricePaidCents: null },
    include: { plan: { select: { priceCents: true } } },
  })
  console.log(`Backfilling pricePaidCents on ${unpricedActive.length} active subscription(s) with no snapshot yet.`)
  for (const sub of unpricedActive) {
    await db.subscription.update({ where: { id: sub.id }, data: { pricePaidCents: sub.plan.priceCents } })
  }

  console.log('Done.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
