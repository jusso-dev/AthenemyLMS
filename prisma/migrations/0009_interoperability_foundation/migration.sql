DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExternalPackageType') THEN
    CREATE TYPE "ExternalPackageType" AS ENUM ('SCORM_12', 'XAPI', 'LTI');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExternalPackageStatus') THEN
    CREATE TYPE "ExternalPackageStatus" AS ENUM ('READY', 'INVALID', 'DISABLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ExternalPackage" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "courseId" TEXT NOT NULL,
  "lessonId" TEXT,
  "uploadedById" TEXT NOT NULL,
  "type" "ExternalPackageType" NOT NULL,
  "status" "ExternalPackageStatus" NOT NULL DEFAULT 'READY',
  "title" TEXT NOT NULL,
  "identifier" TEXT,
  "version" TEXT,
  "storageKey" TEXT,
  "launchPath" TEXT,
  "launchUrl" TEXT,
  "manifest" JSONB,
  "validationLog" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExternalPackageAttempt" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "lessonId" TEXT,
  "completionStatus" TEXT NOT NULL DEFAULT 'unknown',
  "successStatus" TEXT,
  "scoreScaled" DOUBLE PRECISION,
  "scoreRaw" DOUBLE PRECISION,
  "totalTimeSeconds" INTEGER NOT NULL DEFAULT 0,
  "suspendData" TEXT,
  "lastStatement" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalPackageAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExternalPackage_courseId_type_status_idx" ON "ExternalPackage"("courseId", "type", "status");
CREATE INDEX IF NOT EXISTS "ExternalPackage_lessonId_status_idx" ON "ExternalPackage"("lessonId", "status");
CREATE INDEX IF NOT EXISTS "ExternalPackage_organizationId_type_idx" ON "ExternalPackage"("organizationId", "type");
CREATE UNIQUE INDEX IF NOT EXISTS "ExternalPackageAttempt_packageId_userId_key" ON "ExternalPackageAttempt"("packageId", "userId");
CREATE INDEX IF NOT EXISTS "ExternalPackageAttempt_courseId_completionStatus_idx" ON "ExternalPackageAttempt"("courseId", "completionStatus");
CREATE INDEX IF NOT EXISTS "ExternalPackageAttempt_lessonId_completionStatus_idx" ON "ExternalPackageAttempt"("lessonId", "completionStatus");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExternalPackage_organizationId_fkey') THEN
    ALTER TABLE "ExternalPackage"
    ADD CONSTRAINT "ExternalPackage_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExternalPackage_courseId_fkey') THEN
    ALTER TABLE "ExternalPackage"
    ADD CONSTRAINT "ExternalPackage_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExternalPackage_lessonId_fkey') THEN
    ALTER TABLE "ExternalPackage"
    ADD CONSTRAINT "ExternalPackage_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExternalPackage_uploadedById_fkey') THEN
    ALTER TABLE "ExternalPackage"
    ADD CONSTRAINT "ExternalPackage_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExternalPackageAttempt_packageId_fkey') THEN
    ALTER TABLE "ExternalPackageAttempt"
    ADD CONSTRAINT "ExternalPackageAttempt_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "ExternalPackage"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExternalPackageAttempt_userId_fkey') THEN
    ALTER TABLE "ExternalPackageAttempt"
    ADD CONSTRAINT "ExternalPackageAttempt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExternalPackageAttempt_courseId_fkey') THEN
    ALTER TABLE "ExternalPackageAttempt"
    ADD CONSTRAINT "ExternalPackageAttempt_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExternalPackageAttempt_lessonId_fkey') THEN
    ALTER TABLE "ExternalPackageAttempt"
    ADD CONSTRAINT "ExternalPackageAttempt_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
