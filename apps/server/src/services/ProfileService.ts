import { db } from '@project/db'
import { isPremiumUser } from '../lib/entitlements'
import { isBlockedEitherWay } from '../lib/blocks'
import { PROFILE_INCLUDE, serializeProfile } from '../lib/serializers'

export class ProfileService {
  /**
   * Photo gate: revealed for the profile's own owner, or a viewer with an active
   * subscription. Block gate: 404 (not 403) for a blocked pair — a block should be
   * indistinguishable from "this profile doesn't exist" to the blocked party.
   */
  async getProfile(viewerUserId: string, viewerProfileId: string, targetProfileId: string) {
    const profile = await db.profile.findUnique({
      where: { id: targetProfileId },
      include: PROFILE_INCLUDE,
    })
    if (!profile) throw { statusCode: 404, message: 'Profile not found' }

    const isSelf = profile.id === viewerProfileId
    if (!isSelf && (await isBlockedEitherWay(viewerProfileId, targetProfileId))) {
      throw { statusCode: 404, message: 'Profile not found' }
    }

    const revealPhoto = isSelf || (await isPremiumUser(viewerUserId))
    return serializeProfile(profile, { revealPhoto })
  }

  async updateMyProfile(
    profileId: string,
    input: {
      displayName?: string
      genderIdentity?: string | null
      bio?: string | null
      seekingGenders?: string[]
      locationLat?: number | null
      locationLng?: number | null
      locationLabel?: string | null
      avatarUrl?: string | null
      photos?: string[]
      isDiscoverable?: boolean
    },
  ) {
    const { seekingGenders, photos, ...rest } = input

    await db.$transaction(async (tx) => {
      await tx.profile.update({ where: { id: profileId }, data: rest })
      if (seekingGenders) {
        await tx.profileSeekingGender.deleteMany({ where: { profileId } })
        if (seekingGenders.length) {
          await tx.profileSeekingGender.createMany({
            data: seekingGenders.map((gender) => ({ profileId, gender })),
          })
        }
      }
      if (photos) {
        // Whole-array replace, driven by the URLs POST /media/upload returns — the
        // client uploads first, then PATCHes the resulting URL list here.
        await tx.profilePhoto.deleteMany({ where: { profileId } })
        if (photos.length) {
          await tx.profilePhoto.createMany({
            data: photos.map((url, sortOrder) => ({ profileId, url, sortOrder })),
          })
        }
      }
    })

    const profile = await db.profile.findUniqueOrThrow({
      where: { id: profileId },
      include: PROFILE_INCLUDE,
    })
    return serializeProfile(profile, { revealPhoto: true })
  }
}
