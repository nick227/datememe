// Shared response shaping — kept here (not duplicated per service) so the Entity/Category
// JSON shape can't drift between the taxonomy and list endpoints.

export const PROFILE_FULL_SELECT = {
  id: true,
  userId: true,
  username: true,
  displayName: true,
  genderIdentity: true,
  bio: true,
  locationLabel: true,
  avatarUrl: true,
  isDiscoverable: true,
  onboardingStep: true,
  seekingGenders: true,
  photos: { select: { url: true, sortOrder: true }, orderBy: { sortOrder: 'asc' as const } }
} as const

export const PROFILE_SUMMARY_SELECT = {
  id: true,
  userId: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  isDiscoverable: true,
} as const

export function serializeProfile(profile: any, opts: { revealPhoto: boolean }) {
  return {
    id: profile.id,
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    genderIdentity: profile.genderIdentity,
    bio: profile.bio,
    seekingGenders: (profile.seekingGenders ?? []).map((g: any) => g.gender),
    locationLabel: profile.locationLabel,
    avatarUrl: opts.revealPhoto ? profile.avatarUrl : null,
    photos: opts.revealPhoto ? (profile.photos ?? []).map((p: any) => p.url) : [],
    // Distinguishes "withheld by the photo gate" from "this profile just has
    // no photos" — a null avatarUrl alone can't tell a client which one it
    // got, and guessing from that got a genuinely photo-less profile a
    // permanent (and wrong) "go premium to see their photos" message.
    photosLocked: !opts.revealPhoto,
    isDiscoverable: profile.isDiscoverable,
    onboardingStep: profile.onboardingStep,
  }
}

/** For /auth/* responses only — the subject is always the caller's own account, so the photo gate never applies. */
export function serializeUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    profile: user.profile ? serializeProfile(user.profile, { revealPhoto: true }) : undefined,
  }
}

export const ENTITY_SELECT = {
  id: true,
  entityTypeId: true,
  canonicalName: true,
  slug: true,
  imageUrl: true,
  metadata: true,
  status: true,
  usageCount: true,
  submittedByProfileId: true,
  mediaAssets: { where: { isPrimary: true }, orderBy: { createdAt: 'desc' }, take: 1 },
} as const

export function serializeImageCredit(asset: any) {
  return asset ? { attribution: asset.attribution ?? asset.creator ?? asset.license, landingUrl: asset.landingUrl, licenseUrl: asset.licenseUrl, provider: asset.provider } : null
}

export function serializeEntity(entity: any) {
  const primaryImage = entity.mediaAssets?.find((asset: any) => asset.isPrimary)?.publicUrl
  return {
    id: entity.id,
    entityTypeId: entity.entityTypeId,
    canonicalName: entity.canonicalName,
    slug: entity.slug,
    imageUrl: primaryImage ?? entity.imageUrl,
    imageCredit: serializeImageCredit(entity.mediaAssets?.[0]),
    metadata: entity.metadata,
    status: entity.status,
    usageCount: entity.usageCount,
  }
}

export function serializeCategory(category: any) {
  const asset = category.mediaAssets?.find((asset: any) => asset.isPrimary) ?? category.entityType?.mediaAssets?.[0]
  const primaryImage = asset?.publicUrl ?? null
  return {
    id: category.id,
    slug: category.slug,
    groupId: category.groupId,
    entityTypeId: category.entityTypeId,
    prompt: category.prompt,
    shortLabel: category.shortLabel,
    minItems: category.minItems,
    maxItems: category.maxItems,
    orderingMode: category.orderingMode,
    isPremiumOnly: category.isPremiumOnly,
    popularityCount: category.popularityCount,
    topPick: category.topPickEntity ? serializeEntity(category.topPickEntity) : null,
    // Viewer-specific — not a DB column. TaxonomyService attaches this to the row
    // before serializing; defaults to null for any caller that doesn't.
    matchAnswerMultiplier: category.matchAnswerMultiplier ?? null,
    requiredTags: (category.requiredTags ?? []).map((rt: any) => rt.tag),
    imageUrl: primaryImage,
    imageCredit: serializeImageCredit(asset),
  }
}

export const CATEGORY_SELECT = {
  id: true,
  entityType: { select: { mediaAssets: { where: { isPrimary: true }, orderBy: { createdAt: 'desc' as const }, take: 1 } } },
  slug: true,
  groupId: true,
  entityTypeId: true,
  prompt: true,
  shortLabel: true,
  minItems: true,
  maxItems: true,
  orderingMode: true,
  isPremiumOnly: true,
  popularityCount: true,
  topPickEntity: { select: ENTITY_SELECT },
  requiredTags: { select: { tag: true } },
  mediaAssets: { where: { isPrimary: true }, orderBy: { createdAt: 'desc' }, take: 1 },
} as const

export function serializeListItem(item: any) {
  return {
    id: item.id,
    entityId: item.entityId,
    rank: item.rank,
    note: item.note,
    entity: serializeEntity(item.entity),
  }
}

/**
 * The single enforcement point for docs §5.3's visibility rule: a PENDING/REJECTED
 * entity is visible only to the profile that submitted it. Every code path that
 * renders a list to anyone other than its owner must call this, never the raw rows.
 */
export function serializeListForViewer(list: any, viewerProfileId: string) {
  const visibleItems = list.items.filter(
    (item: any) => item.entity.status === 'APPROVED' || item.entity.submittedByProfileId === viewerProfileId,
  )
  return {
    id: list.id,
    categoryId: list.categoryId,
    category: list.category ? serializeCategory(list.category) : undefined,
    title: list.title,
    visibility: list.visibility,
    isComplete: list.isComplete,
    completedAt: list.completedAt ? list.completedAt.toISOString() : null,
    items: visibleItems
      .slice()
      .sort((a: any, b: any) => a.rank - b.rank)
      .map(serializeListItem),
  }
}

export const LIST_PREVIEW_SELECT = {
  id: true,
  categoryId: true,
  profileId: true,
  title: true,
  visibility: true,
  isComplete: true,
  completedAt: true,
  category: { select: CATEGORY_SELECT },
  items: {
    select: {
      id: true,
      rank: true,
      note: true,
      entityId: true,
      listId: true,
      entity: { select: ENTITY_SELECT }
    }
  }
} as const
