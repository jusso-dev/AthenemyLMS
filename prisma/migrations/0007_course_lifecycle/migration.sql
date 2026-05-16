ALTER TABLE "Course"
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "archivedById" TEXT;

CREATE TABLE IF NOT EXISTS "CourseLifecycleEvent" (
  "id" TEXT NOT NULL,
  "courseId" TEXT,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" "CourseStatus",
  "toStatus" "CourseStatus",
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CourseLifecycleEvent_courseId_createdAt_idx" ON "CourseLifecycleEvent"("courseId", "createdAt");
CREATE INDEX IF NOT EXISTS "CourseLifecycleEvent_actorId_createdAt_idx" ON "CourseLifecycleEvent"("actorId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CourseLifecycleEvent_courseId_fkey'
  ) THEN
    ALTER TABLE "CourseLifecycleEvent"
    ADD CONSTRAINT "CourseLifecycleEvent_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
