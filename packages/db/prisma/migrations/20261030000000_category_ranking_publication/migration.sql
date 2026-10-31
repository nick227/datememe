ALTER TABLE `Category`
  ADD COLUMN `answerRevision` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `rankingRevision` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `ResultSet` ADD COLUMN `sourceRevision` INTEGER NOT NULL DEFAULT 0;
CREATE TABLE `CategoryRankingRefresh` (
  `categoryId` VARCHAR(191) NOT NULL,
  `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `lastError` TEXT NULL,
  INDEX `CategoryRankingRefresh_availableAt_idx` (`availableAt`),
  PRIMARY KEY (`categoryId`),
  CONSTRAINT `CategoryRankingRefresh_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Existing categories also need a first snapshot under the one-vote rule.
INSERT INTO `CategoryRankingRefresh` (`categoryId`) SELECT `id` FROM `Category`;
