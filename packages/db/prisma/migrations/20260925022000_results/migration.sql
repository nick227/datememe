-- CreateTable
CREATE TABLE `ResultSet` (
    `id` VARCHAR(191) NOT NULL,
    `subjectType` ENUM('ENTITY', 'PROFILE') NOT NULL,
    `metric` ENUM('LIST_SCORE', 'MOST_LIKED', 'RISING', 'MOST_COMPATIBLE', 'MOST_DISTINCTIVE', 'MOST_ACTIVE') NOT NULL,
    `scopeType` ENUM('GLOBAL', 'CATEGORY') NOT NULL,
    `scopeValue` VARCHAR(191) NULL,
    `window` ENUM('ALL_TIME', 'DAILY', 'WEEKLY', 'MONTHLY') NOT NULL DEFAULT 'ALL_TIME',
    `takeCount` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ResultSet_subjectType_metric_scopeType_scopeValue_window_key`(`subjectType`, `metric`, `scopeType`, `scopeValue`, `window`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResultEntry` (
    `id` VARCHAR(191) NOT NULL,
    `resultSetId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `rank` INTEGER NOT NULL,
    `previousRank` INTEGER NULL,
    `score` INTEGER NOT NULL,

    INDEX `ResultEntry_resultSetId_rank_idx`(`resultSetId`, `rank`),
    UNIQUE INDEX `ResultEntry_resultSetId_subjectId_key`(`resultSetId`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ResultEntry` ADD CONSTRAINT `ResultEntry_resultSetId_fkey` FOREIGN KEY (`resultSetId`) REFERENCES `ResultSet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

