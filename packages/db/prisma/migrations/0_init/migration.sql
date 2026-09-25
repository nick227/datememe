-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NULL,
    `role` ENUM('USER', 'MODERATOR', 'ADMIN') NOT NULL DEFAULT 'USER',
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `suspendedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PushToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL DEFAULT 'expo',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PushToken_token_key`(`token`),
    INDEX `PushToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Session_token_key`(`token`),
    INDEX `Session_token_idx`(`token`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminAuditEvent` (
    `id` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NOT NULL,
    `actorRole` ENUM('USER', 'MODERATOR', 'ADMIN') NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NULL,
    `beforeValue` JSON NULL,
    `afterValue` JSON NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminAuditEvent_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    INDEX `AdminAuditEvent_action_createdAt_idx`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PasswordResetToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailVerificationToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailVerificationToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Profile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `birthdate` DATETIME(3) NOT NULL,
    `genderIdentity` VARCHAR(191) NULL,
    `preferredMinAge` INTEGER NOT NULL DEFAULT 18,
    `preferredMaxAge` INTEGER NOT NULL DEFAULT 99,
    `bio` VARCHAR(150) NULL,
    `locationLat` DOUBLE NULL,
    `locationLng` DOUBLE NULL,
    `locationLabel` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `isDiscoverable` BOOLEAN NOT NULL DEFAULT true,
    `onboardingStep` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Profile_userId_key`(`userId`),
    UNIQUE INDEX `Profile_username_key`(`username`),
    INDEX `Profile_locationLat_locationLng_idx`(`locationLat`, `locationLng`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Block` (
    `id` VARCHAR(191) NOT NULL,
    `blockerProfileId` VARCHAR(191) NOT NULL,
    `blockedProfileId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Block_blockedProfileId_idx`(`blockedProfileId`),
    UNIQUE INDEX `Block_blockerProfileId_blockedProfileId_key`(`blockerProfileId`, `blockedProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Report` (
    `id` VARCHAR(191) NOT NULL,
    `reporterProfileId` VARCHAR(191) NOT NULL,
    `targetType` ENUM('PROFILE', 'MESSAGE') NOT NULL,
    `targetProfileId` VARCHAR(191) NULL,
    `targetMessageId` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NOT NULL,
    `details` TEXT NULL,
    `status` ENUM('PENDING', 'REVIEWED', 'ACTIONED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,
    `reviewedByUserId` VARCHAR(191) NULL,
    `reviewNotes` TEXT NULL,

    INDEX `Report_status_idx`(`status`),
    INDEX `Report_targetProfileId_idx`(`targetProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProfileSeekingGender` (
    `profileId` VARCHAR(191) NOT NULL,
    `gender` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`profileId`, `gender`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProfilePhoto` (
    `id` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProfilePhoto_profileId_sortOrder_key`(`profileId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Swipe` (
    `id` VARCHAR(191) NOT NULL,
    `actorProfileId` VARCHAR(191) NOT NULL,
    `targetProfileId` VARCHAR(191) NOT NULL,
    `action` ENUM('LIKE', 'PASS') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Swipe_targetProfileId_idx`(`targetProfileId`),
    UNIQUE INDEX `Swipe_actorProfileId_targetProfileId_key`(`actorProfileId`, `targetProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EntityType` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `pluralLabel` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NULL,
    `metadataSchema` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `parentId` VARCHAR(191) NULL,

    UNIQUE INDEX `EntityType_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Entity` (
    `id` VARCHAR(191) NOT NULL,
    `entityTypeId` VARCHAR(191) NOT NULL,
    `canonicalName` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `externalIds` JSON NULL,
    `sourceType` ENUM('SEEDED', 'IMPORTED', 'USER_SUBMITTED', 'AI_GENERATED') NOT NULL DEFAULT 'SEEDED',
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'MERGED') NOT NULL DEFAULT 'APPROVED',
    `mergedIntoId` VARCHAR(191) NULL,
    `usageCount` INTEGER NOT NULL DEFAULT 0,
    `submittedByProfileId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `parentId` VARCHAR(191) NULL,

    INDEX `Entity_entityTypeId_status_idx`(`entityTypeId`, `status`),
    INDEX `Entity_entityTypeId_usageCount_idx`(`entityTypeId`, `usageCount`),
    INDEX `Entity_canonicalName_idx`(`canonicalName`),
    UNIQUE INDEX `Entity_entityTypeId_slug_key`(`entityTypeId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EntityExternalRef` (
    `id` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EntityExternalRef_provider_externalId_idx`(`provider`, `externalId`),
    UNIQUE INDEX `EntityExternalRef_entityId_provider_key`(`entityId`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaAsset` (
    `id` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `entityTypeId` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NULL,
    `sourceId` VARCHAR(191) NULL,
    `sourceUrl` TEXT NULL,
    `landingUrl` TEXT NULL,
    `creator` VARCHAR(191) NULL,
    `license` VARCHAR(191) NULL,
    `licenseUrl` TEXT NULL,
    `attribution` TEXT NULL,
    `importRule` VARCHAR(191) NOT NULL DEFAULT 'REVIEW_REQUIRED',
    `originalWidth` INTEGER NULL,
    `originalHeight` INTEGER NULL,
    `crop` JSON NULL,
    `storageKey` VARCHAR(191) NULL,
    `publicUrl` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NULL,
    `byteSize` INTEGER NULL,
    `sha256` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MediaAsset_entityId_isPrimary_idx`(`entityId`, `isPrimary`),
    INDEX `MediaAsset_entityTypeId_isPrimary_idx`(`entityTypeId`, `isPrimary`),
    INDEX `MediaAsset_categoryId_isPrimary_idx`(`categoryId`, `isPrimary`),
    INDEX `MediaAsset_provider_sourceId_idx`(`provider`, `sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EntityAlias` (
    `id` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `alias` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(191) NOT NULL DEFAULT 'en',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EntityAlias_alias_idx`(`alias`),
    UNIQUE INDEX `EntityAlias_entityId_alias_key`(`entityId`, `alias`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `kind` ENUM('DECADE', 'GENRE', 'PLATFORM', 'REGION', 'ERA', 'CUSTOM') NOT NULL DEFAULT 'CUSTOM',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Tag_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EntityTag` (
    `entityId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`entityId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EntitySubmission` (
    `id` VARCHAR(191) NOT NULL,
    `entityTypeId` VARCHAR(191) NOT NULL,
    `rawText` VARCHAR(191) NOT NULL,
    `submittedByProfileId` VARCHAR(191) NULL,
    `submittedEntityId` VARCHAR(191) NOT NULL,
    `suggestedMatchId` VARCHAR(191) NULL,
    `resolvedEntityId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'MERGED') NOT NULL DEFAULT 'PENDING',
    `reviewedByUserId` VARCHAR(191) NULL,
    `reviewNotes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,

    UNIQUE INDEX `EntitySubmission_submittedEntityId_key`(`submittedEntityId`),
    INDEX `EntitySubmission_status_entityTypeId_idx`(`status`, `entityTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CategoryGroup` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CategoryGroup_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `entityTypeId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `prompt` VARCHAR(191) NOT NULL,
    `shortLabel` VARCHAR(191) NOT NULL,
    `minItems` INTEGER NOT NULL DEFAULT 1,
    `maxItems` INTEGER NOT NULL DEFAULT 5,
    `orderingMode` ENUM('RANKED', 'UNRANKED') NOT NULL DEFAULT 'RANKED',
    `isMatchSignal` BOOLEAN NOT NULL DEFAULT true,
    `isPremiumOnly` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `poolMode` VARCHAR(191) NOT NULL DEFAULT 'FILTERED',
    `popularityCount` INTEGER NOT NULL DEFAULT 0,
    `parentEntityId` VARCHAR(191) NULL,
    `topPickEntityId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_slug_key`(`slug`),
    INDEX `Category_groupId_idx`(`groupId`),
    INDEX `Category_isActive_idx`(`isActive`),
    INDEX `Category_entityTypeId_idx`(`entityTypeId`),
    INDEX `Category_parentEntityId_idx`(`parentEntityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CategoryTag` (
    `categoryId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`categoryId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CategoryEntity` (
    `categoryId` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`categoryId`, `entityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SitePickGroup` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SitePickGroup_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SitePickItem` (
    `groupId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `SitePickItem_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`groupId`, `categoryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `List` (
    `id` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `visibility` ENUM('PUBLIC', 'PREMIUM_ONLY', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
    `isComplete` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `List_profileId_idx`(`profileId`),
    INDEX `List_categoryId_idx`(`categoryId`),
    UNIQUE INDEX `List_profileId_categoryId_key`(`profileId`, `categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ListItem` (
    `id` VARCHAR(191) NOT NULL,
    `listId` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `rank` INTEGER NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ListItem_entityId_idx`(`entityId`),
    UNIQUE INDEX `ListItem_listId_rank_key`(`listId`, `rank`),
    UNIQUE INDEX `ListItem_listId_entityId_key`(`listId`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuickPickSignal` (
    `id` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,
    `contextType` ENUM('CATEGORY', 'ENTITY_TYPE', 'PARENT_ENTITY', 'TAG') NOT NULL,
    `contextId` VARCHAR(191) NOT NULL,
    `entity1Id` VARCHAR(191) NOT NULL,
    `entity2Id` VARCHAR(191) NOT NULL,
    `winnerId` VARCHAR(191) NOT NULL,
    `loserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuickPickSignal_profileId_contextType_contextId_idx`(`profileId`, `contextType`, `contextId`),
    INDEX `QuickPickSignal_profileId_entity1Id_entity2Id_idx`(`profileId`, `entity1Id`, `entity2Id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED') NOT NULL DEFAULT 'ACCEPTED',
    `initiatedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationParticipant` (
    `conversationId` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,
    `lastReadAt` DATETIME(3) NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`conversationId`, `profileId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `body` TEXT NULL,
    `attachments` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `Message_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    INDEX `Message_senderId_createdAt_idx`(`senderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plan` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `interval` ENUM('MONTHLY', 'ANNUAL', 'LIFETIME') NOT NULL,
    `priceCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Plan_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `provider` ENUM('APPLE_APP_STORE', 'GOOGLE_PLAY', 'STRIPE', 'MANUAL') NOT NULL,
    `providerSubscriptionId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED') NOT NULL,
    `currentPeriodEnd` DATETIME(3) NOT NULL,
    `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    `entitlementFloor` JSON NULL,
    `pricePaidCents` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subscription_providerSubscriptionId_key`(`providerSubscriptionId`),
    INDEX `Subscription_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WaitlistSignup` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WaitlistSignup_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JobQueue` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'DONE', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `lockedAt` DATETIME(3) NULL,
    `lockedBy` VARCHAR(191) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `JobQueue_status_availableAt_lockedAt_idx`(`status`, `availableAt`, `lockedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompatibilityScore` (
    `id` VARCHAR(191) NOT NULL,
    `profileIdA` VARCHAR(191) NOT NULL,
    `profileIdB` VARCHAR(191) NOT NULL,
    `score` DOUBLE NOT NULL,
    `sharedItemsCount` INTEGER NOT NULL,
    `sharedFavorites` JSON NOT NULL,
    `insights` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CompatibilityScore_profileIdA_score_idx`(`profileIdA`, `score` DESC),
    INDEX `CompatibilityScore_profileIdB_score_idx`(`profileIdB`, `score` DESC),
    UNIQUE INDEX `CompatibilityScore_profileIdA_profileIdB_key`(`profileIdA`, `profileIdB`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EntitlementPolicy` (
    `id` VARCHAR(191) NOT NULL,
    `state` ENUM('FREE', 'MEMBER') NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` VARCHAR(191) NULL,

    UNIQUE INDEX `EntitlementPolicy_state_key_key`(`state`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MembershipGrant` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `source` ENUM('MANUAL_ADMIN', 'SIGNUP_PROMOTION', 'COUPON_REDEMPTION', 'ONE_TIME_PURCHASE') NOT NULL,
    `reason` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `entitlementFloor` JSON NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedByUserId` VARCHAR(191) NULL,
    `revokeReason` VARCHAR(191) NULL,
    `grantedByUserId` VARCHAR(191) NULL,
    `signupPromotionId` VARCHAR(191) NULL,
    `couponRedemptionId` VARCHAR(191) NULL,
    `planId` VARCHAR(191) NULL,
    `pricePaidCentsSnapshot` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MembershipGrant_couponRedemptionId_key`(`couponRedemptionId`),
    INDEX `MembershipGrant_userId_idx`(`userId`),
    INDEX `MembershipGrant_expiresAt_idx`(`expiresAt`),
    INDEX `MembershipGrant_source_idx`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SignupPromotion` (
    `id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `awardType` ENUM('LIFETIME_MEMBER', 'TEMPORARY_MEMBER') NOT NULL,
    `durationDays` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdByUserId` VARCHAR(191) NULL,

    INDEX `SignupPromotion_isActive_startAt_endAt_idx`(`isActive`, `startAt`, `endAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GlobalMembershipWindow` (
    `id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdByUserId` VARCHAR(191) NULL,

    INDEX `GlobalMembershipWindow_isActive_startAt_endAt_idx`(`isActive`, `startAt`, `endAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CouponCode` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `discountType` ENUM('PERCENTAGE', 'FULL') NOT NULL,
    `discountPercent` INTEGER NOT NULL,
    `grantDurationDays` INTEGER NULL,
    `campaign` VARCHAR(191) NULL,
    `partner` VARCHAR(191) NULL,
    `maxRedemptions` INTEGER NULL,
    `maxRedemptionsPerUser` INTEGER NOT NULL DEFAULT 1,
    `startAt` DATETIME(3) NULL,
    `endAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdByUserId` VARCHAR(191) NULL,

    UNIQUE INDEX `CouponCode_code_key`(`code`),
    INDEX `CouponCode_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CouponRedemption` (
    `id` VARCHAR(191) NOT NULL,
    `couponCodeId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `codeSnapshot` VARCHAR(191) NOT NULL,
    `discountType` ENUM('PERCENTAGE', 'FULL') NOT NULL,
    `discountPercent` INTEGER NOT NULL,
    `grantDurationDaysSnapshot` INTEGER NULL,
    `campaignSnapshot` VARCHAR(191) NULL,
    `partnerSnapshot` VARCHAR(191) NULL,
    `redeemedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CouponRedemption_userId_idx`(`userId`),
    INDEX `CouponRedemption_couponCodeId_idx`(`couponCodeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Concept` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'NEW',

    UNIQUE INDEX `Concept_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GenerationOperation` (
    `id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NULL,
    `input` JSON NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `systemPrompt` TEXT NOT NULL,
    `userPrompt` TEXT NOT NULL,
    `promptVersion` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `output` JSON NULL,
    `error` TEXT NULL,
    `requestedByUserId` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GenerationOperation_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CategoryDraft` (
    `id` VARCHAR(191) NOT NULL,
    `conceptId` VARCHAR(191) NOT NULL,
    `generationOperationId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `prompt` TEXT NOT NULL,
    `entityTypeId` VARCHAR(191) NULL,
    `groupId` VARCHAR(191) NULL,
    `rules` JSON NOT NULL,
    `approvalState` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `publishedCategoryId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CategoryDraft_publishedCategoryId_key`(`publishedCategoryId`),
    INDEX `CategoryDraft_conceptId_createdAt_idx`(`conceptId`, `createdAt`),
    UNIQUE INDEX `CategoryDraft_conceptId_slug_key`(`conceptId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EntityCandidate` (
    `id` VARCHAR(191) NOT NULL,
    `categoryDraftId` VARCHAR(191) NOT NULL,
    `generationOperationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `details` TEXT NOT NULL,
    `resolutionState` VARCHAR(191) NOT NULL DEFAULT 'UNRESOLVED',
    `resolvedEntityId` VARCHAR(191) NULL,
    `reviewState` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EntityCandidate_categoryDraftId_slug_key`(`categoryDraftId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EntityFacet` (
    `id` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `axis` VARCHAR(60) NOT NULL,
    `value` VARCHAR(120) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `generationOperationId` VARCHAR(191) NULL,

    UNIQUE INDEX `EntityFacet_entityId_axis_value_key`(`entityId`, `axis`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PushToken` ADD CONSTRAINT `PushToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminAuditEvent` ADD CONSTRAINT `AdminAuditEvent_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailVerificationToken` ADD CONSTRAINT `EmailVerificationToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Profile` ADD CONSTRAINT `Profile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Block` ADD CONSTRAINT `Block_blockerProfileId_fkey` FOREIGN KEY (`blockerProfileId`) REFERENCES `Profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Block` ADD CONSTRAINT `Block_blockedProfileId_fkey` FOREIGN KEY (`blockedProfileId`) REFERENCES `Profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_reporterProfileId_fkey` FOREIGN KEY (`reporterProfileId`) REFERENCES `Profile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_targetProfileId_fkey` FOREIGN KEY (`targetProfileId`) REFERENCES `Profile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_targetMessageId_fkey` FOREIGN KEY (`targetMessageId`) REFERENCES `Message`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfileSeekingGender` ADD CONSTRAINT `ProfileSeekingGender_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `Profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfilePhoto` ADD CONSTRAINT `ProfilePhoto_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `Profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Swipe` ADD CONSTRAINT `Swipe_actorProfileId_fkey` FOREIGN KEY (`actorProfileId`) REFERENCES `Profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Swipe` ADD CONSTRAINT `Swipe_targetProfileId_fkey` FOREIGN KEY (`targetProfileId`) REFERENCES `Profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntityType` ADD CONSTRAINT `EntityType_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `EntityType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entity` ADD CONSTRAINT `Entity_entityTypeId_fkey` FOREIGN KEY (`entityTypeId`) REFERENCES `EntityType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entity` ADD CONSTRAINT `Entity_mergedIntoId_fkey` FOREIGN KEY (`mergedIntoId`) REFERENCES `Entity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entity` ADD CONSTRAINT `Entity_submittedByProfileId_fkey` FOREIGN KEY (`submittedByProfileId`) REFERENCES `Profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entity` ADD CONSTRAINT `Entity_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Entity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntityExternalRef` ADD CONSTRAINT `EntityExternalRef_entityId_fkey` FOREIGN KEY (`entityId`) REFERENCES `Entity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_entityId_fkey` FOREIGN KEY (`entityId`) REFERENCES `Entity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_entityTypeId_fkey` FOREIGN KEY (`entityTypeId`) REFERENCES `EntityType`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntityAlias` ADD CONSTRAINT `EntityAlias_entityId_fkey` FOREIGN KEY (`entityId`) REFERENCES `Entity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntityTag` ADD CONSTRAINT `EntityTag_entityId_fkey` FOREIGN KEY (`entityId`) REFERENCES `Entity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntityTag` ADD CONSTRAINT `EntityTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntitySubmission` ADD CONSTRAINT `EntitySubmission_entityTypeId_fkey` FOREIGN KEY (`entityTypeId`) REFERENCES `EntityType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntitySubmission` ADD CONSTRAINT `EntitySubmission_submittedByProfileId_fkey` FOREIGN KEY (`submittedByProfileId`) REFERENCES `Profile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntitySubmission` ADD CONSTRAINT `EntitySubmission_submittedEntityId_fkey` FOREIGN KEY (`submittedEntityId`) REFERENCES `Entity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntitySubmission` ADD CONSTRAINT `EntitySubmission_suggestedMatchId_fkey` FOREIGN KEY (`suggestedMatchId`) REFERENCES `Entity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntitySubmission` ADD CONSTRAINT `EntitySubmission_resolvedEntityId_fkey` FOREIGN KEY (`resolvedEntityId`) REFERENCES `Entity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntitySubmission` ADD CONSTRAINT `EntitySubmission_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `CategoryGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_entityTypeId_fkey` FOREIGN KEY (`entityTypeId`) REFERENCES `EntityType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_parentEntityId_fkey` FOREIGN KEY (`parentEntityId`) REFERENCES `Entity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_topPickEntityId_fkey` FOREIGN KEY (`topPickEntityId`) REFERENCES `Entity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CategoryTag` ADD CONSTRAINT `CategoryTag_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CategoryTag` ADD CONSTRAINT `CategoryTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CategoryEntity` ADD CONSTRAINT `CategoryEntity_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CategoryEntity` ADD CONSTRAINT `CategoryEntity_entityId_fkey` FOREIGN KEY (`entityId`) REFERENCES `Entity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SitePickItem` ADD CONSTRAINT `SitePickItem_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `SitePickGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SitePickItem` ADD CONSTRAINT `SitePickItem_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `List` ADD CONSTRAINT `List_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `Profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `List` ADD CONSTRAINT `List_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ListItem` ADD CONSTRAINT `ListItem_listId_fkey` FOREIGN KEY (`listId`) REFERENCES `List`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ListItem` ADD CONSTRAINT `ListItem_entityId_fkey` FOREIGN KEY (`entityId`) REFERENCES `Entity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuickPickSignal` ADD CONSTRAINT `QuickPickSignal_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `Profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuickPickSignal` ADD CONSTRAINT `QuickPickSignal_entity1Id_fkey` FOREIGN KEY (`entity1Id`) REFERENCES `Entity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuickPickSignal` ADD CONSTRAINT `QuickPickSignal_entity2Id_fkey` FOREIGN KEY (`entity2Id`) REFERENCES `Entity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuickPickSignal` ADD CONSTRAINT `QuickPickSignal_winnerId_fkey` FOREIGN KEY (`winnerId`) REFERENCES `Entity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuickPickSignal` ADD CONSTRAINT `QuickPickSignal_loserId_fkey` FOREIGN KEY (`loserId`) REFERENCES `Entity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_initiatedById_fkey` FOREIGN KEY (`initiatedById`) REFERENCES `Profile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationParticipant` ADD CONSTRAINT `ConversationParticipant_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationParticipant` ADD CONSTRAINT `ConversationParticipant_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `Profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `Profile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MembershipGrant` ADD CONSTRAINT `MembershipGrant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MembershipGrant` ADD CONSTRAINT `MembershipGrant_grantedByUserId_fkey` FOREIGN KEY (`grantedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MembershipGrant` ADD CONSTRAINT `MembershipGrant_revokedByUserId_fkey` FOREIGN KEY (`revokedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MembershipGrant` ADD CONSTRAINT `MembershipGrant_signupPromotionId_fkey` FOREIGN KEY (`signupPromotionId`) REFERENCES `SignupPromotion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MembershipGrant` ADD CONSTRAINT `MembershipGrant_couponRedemptionId_fkey` FOREIGN KEY (`couponRedemptionId`) REFERENCES `CouponRedemption`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MembershipGrant` ADD CONSTRAINT `MembershipGrant_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponRedemption` ADD CONSTRAINT `CouponRedemption_couponCodeId_fkey` FOREIGN KEY (`couponCodeId`) REFERENCES `CouponCode`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponRedemption` ADD CONSTRAINT `CouponRedemption_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GenerationOperation` ADD CONSTRAINT `GenerationOperation_requestedByUserId_fkey` FOREIGN KEY (`requestedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CategoryDraft` ADD CONSTRAINT `CategoryDraft_conceptId_fkey` FOREIGN KEY (`conceptId`) REFERENCES `Concept`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CategoryDraft` ADD CONSTRAINT `CategoryDraft_generationOperationId_fkey` FOREIGN KEY (`generationOperationId`) REFERENCES `GenerationOperation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CategoryDraft` ADD CONSTRAINT `CategoryDraft_entityTypeId_fkey` FOREIGN KEY (`entityTypeId`) REFERENCES `EntityType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CategoryDraft` ADD CONSTRAINT `CategoryDraft_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `CategoryGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CategoryDraft` ADD CONSTRAINT `CategoryDraft_publishedCategoryId_fkey` FOREIGN KEY (`publishedCategoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntityCandidate` ADD CONSTRAINT `EntityCandidate_categoryDraftId_fkey` FOREIGN KEY (`categoryDraftId`) REFERENCES `CategoryDraft`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntityCandidate` ADD CONSTRAINT `EntityCandidate_generationOperationId_fkey` FOREIGN KEY (`generationOperationId`) REFERENCES `GenerationOperation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntityCandidate` ADD CONSTRAINT `EntityCandidate_resolvedEntityId_fkey` FOREIGN KEY (`resolvedEntityId`) REFERENCES `Entity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntityFacet` ADD CONSTRAINT `EntityFacet_entityId_fkey` FOREIGN KEY (`entityId`) REFERENCES `Entity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntityFacet` ADD CONSTRAINT `EntityFacet_generationOperationId_fkey` FOREIGN KEY (`generationOperationId`) REFERENCES `GenerationOperation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
