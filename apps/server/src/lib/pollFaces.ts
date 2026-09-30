import { db } from '@project/db'

const FACE_LIMIT = 3

export async function pollFaces(viewerProfileId: string, categoryId: string) {
  const lists = await db.list.findMany({
    where: {
      categoryId,
      isComplete: true,
      visibility: 'PUBLIC',
      profile: {
        isDiscoverable: true,
        user: { suspendedAt: null, deletedAt: null },
        NOT: {
          OR: [
            { blocksMade: { some: { blockedProfileId: viewerProfileId } } },
            { blocksReceived: { some: { blockerProfileId: viewerProfileId } } },
          ],
        },
      },
    },
    orderBy: { completedAt: 'desc' },
    take: FACE_LIMIT,
    select: { profile: { select: { id: true, displayName: true, avatarUrl: true } } },
  })
  return lists.map((list) => ({
    profileId: list.profile.id,
    displayName: list.profile.displayName,
    avatarUrl: list.profile.avatarUrl,
  }))
}

