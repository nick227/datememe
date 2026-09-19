// Shared response shaping — kept here (not duplicated per service) so the Entity/Category
// JSON shape can't drift between the taxonomy and list endpoints.

/** Every query that will feed serializeProfile/serializeUser must use this include, or seekingGenders/photos silently come back empty. */
export const PROFILE_INCLUDE = { seekingGenders: true, photos: { orderBy: { sortOrder: 'asc' as const } } }

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
    isDiscoverable: profile.isDiscoverable,
    onboardingStep: profile.onboardingStep,
  }
}

/** For /auth/* responses only — the subject is always the caller's own account, so the photo gate never applies. */
export function serializeUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    profile: user.profile ? serializeProfile(user.profile, { revealPhoto: true }) : undefined,
  }
}

export function serializeEntity(entity: any) {
  return {
    id: entity.id,
    entityTypeId: entity.entityTypeId,
    canonicalName: entity.canonicalName,
    slug: entity.slug,
    imageUrl: entity.imageUrl,
    metadata: entity.metadata,
    status: entity.status,
    usageCount: entity.usageCount,
  }
}

export function serializeCategory(category: any) {
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
    requiredTags: (category.requiredTags ?? []).map((rt: any) => rt.tag),
  }
}

export const CATEGORY_INCLUDE = { requiredTags: { include: { tag: true } } } as const

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
    items: visibleItems
      .slice()
      .sort((a: any, b: any) => a.rank - b.rank)
      .map(serializeListItem),
  }
}
