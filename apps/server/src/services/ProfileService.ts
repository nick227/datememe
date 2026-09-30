import { db, Prisma } from '@project/db'
import { resolveEntitlements } from '../lib/entitlements'
import { isBlockedEitherWay } from '../lib/blocks'
import { PROFILE_FULL_SELECT, serializeProfile } from '../lib/serializers'
import { AttributeSide } from '../lib/profileAttributes'

export class ProfileService {
  /**
   * Photo gate: revealed for the profile's own owner, or a viewer with an active
   * subscription. Block gate: 404 (not 403) for a blocked pair — a block should be
   * indistinguishable from "this profile doesn't exist" to the blocked party.
   */
  async getProfile(viewerUserId: string, viewerProfileId: string, targetProfileId: string) {
    const profile = await db.profile.findUnique({
      where: { id: targetProfileId },
      select: PROFILE_FULL_SELECT,
    })
    if (!profile) throw { statusCode: 404, message: 'Profile not found' }

    const isSelf = profile.id === viewerProfileId
    if (!isSelf && (await isBlockedEitherWay(viewerProfileId, targetProfileId))) {
      throw { statusCode: 404, message: 'Profile not found' }
    }

    const revealPhoto = isSelf || ((await resolveEntitlements(viewerUserId))['profile.fullPhotoAccess'])
    return serializeProfile(profile, { revealPhoto })
  }

  async updateMyProfile(
    profileId: string,
    input: {
      displayName?: string
      genderIdentity?: string | null
      bio?: string | null
      seekingGenders?: string[]
      isA?: string[]
      lookingFor?: string[]
      locationLat?: number | null
      locationLng?: number | null
      locationLabel?: string | null
      avatarUrl?: string | null
      photos?: string[]
      isDiscoverable?: boolean
    },
  ) {
    const { seekingGenders, photos, isA, lookingFor, ...rest } = input

    await db.$transaction(async (tx) => {
      const current = rest.displayName != null
        ? await tx.profile.findUnique({ where: { id: profileId }, select: { onboardingStep: true } })
        : null
      await tx.profile.update({
        where: { id: profileId },
        data: current?.onboardingStep === 0 ? { ...rest, onboardingStep: 1 } : rest,
      })
      if (seekingGenders) {
        await tx.profileSeekingGender.deleteMany({ where: { profileId } })
        if (seekingGenders.length) {
          await tx.profileSeekingGender.createMany({
            data: seekingGenders.map((gender) => ({ profileId, gender })),
          })
        }
      }
      if (isA) await replaceAttributes(tx, profileId, 'IS', isA)
      if (lookingFor) await replaceAttributes(tx, profileId, 'SEEKING', lookingFor)
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
      select: PROFILE_FULL_SELECT,
    })
    return serializeProfile(profile, { revealPhoto: true })
  }
}

async function replaceAttributes(tx: Prisma.TransactionClient, profileId: string, side: AttributeSide, keys: string[]) {
  await tx.profileAttribute.deleteMany({ where: { profileId, side } })
  if (!keys.length) return
  await tx.profileAttribute.createMany({ data: keys.map((key) => ({ profileId, key, side })) })
}
