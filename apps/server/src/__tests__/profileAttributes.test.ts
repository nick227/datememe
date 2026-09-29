import { afterAll, describe, expect, it } from 'vitest'
import { db } from '@project/db'
import { ProfileService } from '../services/ProfileService'

describe('ProfileService attributes', () => {
  const service = new ProfileService()
  const createdUserIds: string[] = []

  afterAll(async () => {
    await db.profile.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  })

  it('replaces one side and leaves the other in place', async () => {
    const now = Date.now()
    const user = await db.user.create({
      data: {
        email: `attr-${now}@example.com`,
        passwordHash: 'hash',
        profile: { create: { username: `attr-${now}`, displayName: 'Attr', birthdate: new Date('1993-01-01T00:00:00.000Z') } },
      },
      include: { profile: true },
    })
    createdUserIds.push(user.id)

    const saved = await service.updateMyProfile(user.profile!.id, { isA: ['WRITER', 'MUSICIAN'], lookingFor: ['FRIEND'] })
    expect(saved.isA).toEqual(['MUSICIAN', 'WRITER'])
    expect(saved.lookingFor).toEqual(['FRIEND'])

    const cleared = await service.updateMyProfile(user.profile!.id, { isA: [] })
    expect(cleared.isA).toEqual([])
    expect(cleared.lookingFor).toEqual(['FRIEND'])
  })
})
