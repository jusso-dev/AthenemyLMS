-- The original manifest-only importer fabricated scorm/... keys without storing assets.
-- Current extracted packages use UUID directory identifiers, so this excludes real imports.
UPDATE "ExternalPackage"
SET "status" = 'INVALID',
    "validationLog" = 'Re-import required: legacy manifest registration did not store package assets.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "type" = 'SCORM_12' AND "status" = 'READY'
  AND ("storageKey" IS NULL OR "storageKey" LIKE 'scorm/%');
