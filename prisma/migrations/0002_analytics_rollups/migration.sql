-- CreateEnum
CREATE TYPE "AnalyticsScope" AS ENUM ('COURSE', 'PLATFORM');

-- CreateTable
CREATE TABLE "AnalyticsRollup" (
    "id" TEXT NOT NULL,
    "scope" "AnalyticsScope" NOT NULL,
    "courseId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "activeEnrollments" INTEGER NOT NULL DEFAULT 0,
    "completedEnrollments" INTEGER NOT NULL DEFAULT 0,
    "lessonCompletions" INTEGER NOT NULL DEFAULT 0,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnalyticsRollup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Course_instructorId_status_idx" ON "Course"("instructorId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_status_idx" ON "Enrollment"("courseId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_status_createdAt_idx" ON "Enrollment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LessonProgress_lessonId_completedAt_idx" ON "LessonProgress"("lessonId", "completedAt");

-- CreateIndex
CREATE INDEX "Payment_courseId_status_createdAt_idx" ON "Payment"("courseId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsRollup_scope_courseId_date_key" ON "AnalyticsRollup"("scope", "courseId", "date");

-- CreateIndex
CREATE INDEX "AnalyticsRollup_scope_date_idx" ON "AnalyticsRollup"("scope", "date");

-- CreateIndex
CREATE INDEX "AnalyticsRollup_courseId_date_idx" ON "AnalyticsRollup"("courseId", "date");

-- AddForeignKey
ALTER TABLE "AnalyticsRollup" ADD CONSTRAINT "AnalyticsRollup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
