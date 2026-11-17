ALTER TABLE "Assessment" ADD COLUMN "closesAt" TIMESTAMP(3);
CREATE TABLE "AssessmentAttempt" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deadlineAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssessmentAttempt_assessmentId_userId_attemptNumber_key" ON "AssessmentAttempt"("assessmentId", "userId", "attemptNumber");
CREATE INDEX "AssessmentAttempt_assessmentId_userId_submittedAt_idx" ON "AssessmentAttempt"("assessmentId", "userId", "submittedAt");
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentSubmission" ADD COLUMN "attemptId" TEXT;
CREATE UNIQUE INDEX "AssessmentSubmission_attemptId_key" ON "AssessmentSubmission"("attemptId");
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
