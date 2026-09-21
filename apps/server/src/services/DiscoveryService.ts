import { db } from '@project/db'
import { normalizeLimit } from '../lib/pagination'
import { PROFILE_FULL_SELECT, serializeProfile } from '../lib/serializers'
import { resolveEntitlements } from '../lib/entitlements'
import { computeAge } from '../lib/age'
import { haversineKm, ageBucketToBirthdateRange, ageRangeForPreference, intersectDateRange, type AgeBucket, type DateRange } from '../lib/geo'
import { parseTasteFacet, getTasteEngagedProfileIds } from '../lib/tasteFacet'
import { DISCOVERY_POLICY } from '../lib/discoveryPolicy'
import { normalizeSharedFavorites } from '../lib/sharedFavorites'

export type DiscoveryFilters = {
  cursor?: string
  limit?: number
  /**
   * Each entry is "kind:slug" — e.g. "group:music", "tag:punk". Pool
   * *engagement*, not compatibility: qualifies someone for the pool, doesn't
   * by itself mean shared taste with the viewer (see tasteFacet.ts). Multiple
   * facets are OR'd — engagement in *any* selected facet is enough to
   * qualify (multi-select categories, e.g. "Music" + "Food" together).
   */
  taste?: string[]
  /** Requires the viewer to have their own coordinates set; returns an honest empty result (with filterNotice explaining why) rather than silently ignoring the filter. */
  nearMe?: boolean
  /** A browse shortcut that narrows — never replaces or widens — the viewer's baseline min/max age eligibility. */
  ageBucket?: AgeBucket
  /**
   * Pre-resolved `profile.fullPhotoAccess`, when the caller already paid for
   * a resolveEntitlements() round trip for the same user (ContentFeedService's
   * getDiscoverFeed also needs it for getFavoritedCandidates) — resolveEntitlements
   * is itself a 4-query chain, not worth paying for twice in one request.
   * Left undefined, this resolves it itself (e.g. the bare GET /discovery route).
   */
  fullPhotoAccess?: boolean
}

type DiscoveryCursor = { score: number; id: string; page: number }

export function decodeDiscoveryCursor(cursor?: string): DiscoveryCursor | null {
  if (!cursor) return null
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (!Number.isFinite(value.score) || typeof value.id !== 'string' || !value.id || !Number.isSafeInteger(value.page) || value.page < 1) throw new Error()
    return value
  } catch {
    throw { statusCode: 400, message: 'Invalid discovery cursor' }
  }
}

export class DiscoveryService {
  async getDiscoveryFeed(viewerUserId: string, viewerProfileId: string, opts: DiscoveryFilters) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeDiscoveryCursor(opts.cursor)

    const viewer = await db.profile.findUnique({
      where: { id: viewerProfileId },
      select: {
        genderIdentity: true,
        locationLat: true,
        locationLng: true,
        birthdate: true,
        preferredMinAge: true,
        preferredMaxAge: true,
        seekingGenders: { select: { gender: true } },
      },
    })
    if (opts.nearMe && (viewer?.locationLat == null || viewer?.locationLng == null)) {
      return { data: [], meta: { hasMore: false, nextCursor: null }, filterNotice: 'Add your location in your profile to use Near Me.' }
    }
    const viewerSeekingGenders = viewer?.seekingGenders.map((g) => g.gender) ?? []
    const viewerAge = viewer ? computeAge(viewer.birthdate) : null

    // Taste axis: pool *engagement* (facet.ts), resolved generically so a
    // deeper taxonomy filter (a Tag, an EntityType, eventually a nested
    // group) never needs a new parameter here — only a new case in
    // getTasteEngagedProfileIds. CategoryGroup is the first layer, not the
    // ceiling. Multiple facets (multi-select categories) are OR'd: engaged
    // in any one of them is enough to be in the pool.
    let tasteWhitelist: string[] | null = null
    const facets = (opts.taste ?? []).map(parseTasteFacet).filter((f): f is NonNullable<typeof f> => !!f)
    if (facets.length) {
      const engagedSets = await Promise.all(facets.map((f) => getTasteEngagedProfileIds(f)))
      tasteWhitelist = [...new Set(engagedSets.flat())].filter((id) => id !== viewerProfileId)
      if (!tasteWhitelist.length) return { data: [], meta: { hasMore: false, nextCursor: null } }
    }

    // The whitelist only narrows *which* CompatibilityScore rows are even
    // fetched (pool membership) — it never touches the `score` value itself,
    // which always comes from the real, precomputed row below. Engagement
    // ("has ranked something in this facet") and compatibility ("how much
    // taste these two people actually share") are deliberately kept on
    // opposite sides of this query: one decides eligibility, the other is
    // the evidence shown to the viewer. Conflating them would mean "is in
    // the Music pool" silently becoming "is musically compatible with you",
    // which isn't a claim this filter is entitled to make.
    const scoreCandidateFilter = tasteWhitelist ? { in: tasteWhitelist } : undefined

    // 1. Fetch pre-computed compatibility scores
    const scores = await db.compatibilityScore.findMany({
      where: {
        ...(cursor ? { AND: [{ OR: [{ score: { lt: cursor.score } }, { score: cursor.score, id: { gt: cursor.id } }] }] } : {}),
        OR: [
          { profileIdA: viewerProfileId, ...(scoreCandidateFilter ? { profileIdB: scoreCandidateFilter } : {}) },
          { profileIdB: viewerProfileId, ...(scoreCandidateFilter ? { profileIdA: scoreCandidateFilter } : {}) },
        ],
      },
      select: {
        id: true,
        profileIdA: true,
        profileIdB: true,
        score: true,
        sharedItemsCount: true,
        sharedFavorites: true,
        insights: true,
      },
      orderBy: [{ score: 'desc' }, { id: 'asc' }],
    })

    if (scores.length === 0) {
      return { data: [], meta: { hasMore: false, nextCursor: null } }
    }

    const candidateIds = scores.map((s) => (s.profileIdA === viewerProfileId ? s.profileIdB : s.profileIdA))

    // Baseline age eligibility is mutual (viewer's preference constrains the
    // candidate, the candidate's constrains the viewer) — the same shape as
    // the gender rule below. An age-bucket browse shortcut only narrows this
    // range further; it can never widen past it.
    let birthdateWhere: DateRange | undefined
    if (viewer && viewerAge !== null) {
      birthdateWhere = ageRangeForPreference(viewer.preferredMinAge, viewer.preferredMaxAge)
      if (opts.ageBucket) birthdateWhere = intersectDateRange(birthdateWhere, ageBucketToBirthdateRange(opts.ageBucket))
    } else if (opts.ageBucket) {
      birthdateWhere = ageBucketToBirthdateRange(opts.ageBucket)
    }

    // 2. Fetch profiles — mutual gender compatibility is a baseline
    // correctness rule for a dating app, not an optional chip; age
    // preference is the same kind of baseline (see above). "Near me" and
    // the taxonomy taste axis are the actual opt-in filters.
    const candidates = await db.profile.findMany({
      where: {
        id: { in: candidateIds },
        isDiscoverable: true,
        ...(viewerSeekingGenders.length ? { genderIdentity: { in: viewerSeekingGenders } } : {}),
        ...(viewer?.genderIdentity ? { seekingGenders: { some: { gender: viewer.genderIdentity } } } : {}),
        ...(birthdateWhere ? { birthdate: birthdateWhere } : {}),
        ...(viewerAge !== null ? { preferredMinAge: { lte: viewerAge }, preferredMaxAge: { gte: viewerAge } } : {}),
        NOT: [
          { swipesReceived: { some: { actorProfileId: viewerProfileId } } },
          { blocksMade: { some: { blockedProfileId: viewerProfileId } } },
          { blocksReceived: { some: { blockerProfileId: viewerProfileId } } },
        ],
      },
      // birthdate/locationLat/Lng are selected here only, for age/distance
      // computation — never added to PROFILE_FULL_SELECT itself, since
      // serializeProfile (used broadly) must never emit raw coordinates or DOB.
      select: { ...PROFILE_FULL_SELECT, birthdate: true, locationLat: true, locationLng: true },
    })

    let filterNotice: string | undefined
    let withinRange = candidates
    if (opts.nearMe) {
      if (viewer?.locationLat == null || viewer?.locationLng == null) {
        // Honest empty, not a silent revert to "All" — the caller (UI) must
        // explain this, not guess at it.
        withinRange = []
        filterNotice = 'Add your location in your profile to use Near Me.'
      } else {
        withinRange = candidates.filter(
          (c: any) =>
            c.locationLat != null &&
            c.locationLng != null &&
            haversineKm(viewer.locationLat!, viewer.locationLng!, c.locationLat, c.locationLng) <= DISCOVERY_POLICY.nearMeRadiusKm,
        )
      }
    }

    const candidatesById = new Map(withinRange.map((c: any) => [c.id, c]))
    const fullPhotoAccess = opts.fullPhotoAccess ?? (await resolveEntitlements(viewerUserId))['profile.fullPhotoAccess']

    const eligibleScores = scores.filter((score) => {
      const candidateId = score.profileIdA === viewerProfileId ? score.profileIdB : score.profileIdA
      return candidatesById.has(candidateId)
    })
    const hasMore = limit < eligibleScores.length
    const pageScores = eligibleScores.slice(0, limit)

    // 3. Assemble the response payload functionally
    const data = pageScores.flatMap((s) => {
      const candidateId = s.profileIdA === viewerProfileId ? s.profileIdB : s.profileIdA
      const profile = candidatesById.get(candidateId)

      // Filtered out by gender/age/location/taste/blocks/swipes, or already swiped.
      if (!profile) return []

      return [
        {
          profile: serializeProfile(profile, { revealPhoto: fullPhotoAccess }),
          age: computeAge(profile.birthdate),
          sharedItemsCount: s.sharedItemsCount,
          sharedFavorites: normalizeSharedFavorites(s.sharedFavorites),
          matchPercentage: s.score,
          insights: s.insights,
        },
      ]
    })

    const last = pageScores[pageScores.length - 1]
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({ score: last.score, id: last.id, page: (cursor?.page ?? 0) + 1 })).toString('base64url')
      : null

    return { data, meta: { hasMore, nextCursor }, ...(filterNotice ? { filterNotice } : {}) }
  }
}
