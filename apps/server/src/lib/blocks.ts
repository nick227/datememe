import { db } from '@project/db'

/**
 * Single check used everywhere two profiles are about to interact (view, swipe,
 * message) — a block in EITHER direction is mutual invisibility, not a one-way gate.
 */
export async function isBlockedEitherWay(profileIdA: string, profileIdB: string): Promise<boolean> {
  const block = await db.block.findFirst({
    where: {
      OR: [
        { blockerProfileId: profileIdA, blockedProfileId: profileIdB },
        { blockerProfileId: profileIdB, blockedProfileId: profileIdA },
      ],
    },
  })
  return !!block
}
