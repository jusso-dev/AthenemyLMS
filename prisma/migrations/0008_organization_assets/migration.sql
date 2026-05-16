DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationAssetKind') THEN
    CREATE TYPE "OrganizationAssetKind" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "OrganizationAsset" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "kind" "OrganizationAssetKind" NOT NULL DEFAULT 'IMAGE',
  "storageKey" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "altText" TEXT,
  "caption" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "usageNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrganizationAsset_organizationId_kind_createdAt_idx"
ON "OrganizationAsset"("organizationId", "kind", "createdAt");

CREATE INDEX IF NOT EXISTS "OrganizationAsset_uploadedById_createdAt_idx"
ON "OrganizationAsset"("uploadedById", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationAsset_organizationId_fkey'
  ) THEN
    ALTER TABLE "OrganizationAsset"
    ADD CONSTRAINT "OrganizationAsset_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationAsset_uploadedById_fkey'
  ) THEN
    ALTER TABLE "OrganizationAsset"
    ADD CONSTRAINT "OrganizationAsset_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
