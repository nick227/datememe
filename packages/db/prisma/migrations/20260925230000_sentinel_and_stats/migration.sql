-- Deduplicate any existing NULL rows (by taking the one with highest takeCount, dropping others)
WITH RankedNulls AS (
    SELECT id, ROW_NUMBER() OVER(PARTITION BY subjectType, metric, scopeType, window ORDER BY takeCount DESC, id ASC) as rn
    FROM ResultSet
    WHERE scopeValue IS NULL
)
DELETE FROM ResultEntry
WHERE resultSetId IN (SELECT id FROM RankedNulls WHERE rn > 1);

DELETE FROM ResultSet
WHERE id IN (SELECT id FROM RankedNulls WHERE rn > 1);

-- Update the remaining NULL rows to '_GLOBAL_'
UPDATE ResultSet 
SET scopeValue = '_GLOBAL_' 
WHERE scopeValue IS NULL;

-- Finally, enforce NOT NULL
ALTER TABLE ResultSet MODIFY scopeValue VARCHAR(191) NOT NULL;

-- Add EntityCategoryStat table
CREATE TABLE EntityCategoryStat (
    entityId VARCHAR(191) NOT NULL,
    categoryId VARCHAR(191) NOT NULL,
    usageCount INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (entityId, categoryId)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE EntityCategoryStat ADD CONSTRAINT EntityCategoryStat_entityId_fkey FOREIGN KEY (entityId) REFERENCES Entity(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE EntityCategoryStat ADD CONSTRAINT EntityCategoryStat_categoryId_fkey FOREIGN KEY (categoryId) REFERENCES Category(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop JSON column (assuming data is being recomputed anyway)
ALTER TABLE Entity DROP COLUMN usageCountByCategory;
