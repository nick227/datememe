-- AlterTable
ALTER TABLE `Category` ADD COLUMN `poolMode` VARCHAR(191) NOT NULL DEFAULT 'FILTERED';

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

