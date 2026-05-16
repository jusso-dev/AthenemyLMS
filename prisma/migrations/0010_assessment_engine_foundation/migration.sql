DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssessmentQuestionType') THEN
    CREATE TYPE "AssessmentQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE', 'SHORT_ANSWER', 'LONG_ANSWER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssessmentFeedbackMode') THEN
    CREATE TYPE "AssessmentFeedbackMode" AS ENUM ('IMMEDIATE', 'AFTER_PASSING', 'AFTER_CLOSE', 'HIDDEN');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'SURVEY'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AssessmentType')
  ) THEN
    ALTER TYPE "AssessmentType" ADD VALUE 'SURVEY';
  END IF;
END $$;

ALTER TABLE "Assessment"
ADD COLUMN IF NOT EXISTS "questionBankId" TEXT,
ADD COLUMN IF NOT EXISTS "maxAttempts" INTEGER,
ADD COLUMN IF NOT EXISTS "timeLimitMinutes" INTEGER,
ADD COLUMN IF NOT EXISTS "feedbackMode" "AssessmentFeedbackMode" NOT NULL DEFAULT 'IMMEDIATE';

ALTER TABLE "AssessmentQuestion"
ADD COLUMN IF NOT EXISTS "type" "AssessmentQuestionType" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "AssessmentSubmission"
ADD COLUMN IF NOT EXISTS "attemptNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "feedback" TEXT,
ADD COLUMN IF NOT EXISTS "gradedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "QuestionBank" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "courseId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionBank_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "QuestionBankQuestion" (
  "id" TEXT NOT NULL,
  "questionBankId" TEXT NOT NULL,
  "type" "AssessmentQuestionType" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
  "prompt" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "correctIndex" INTEGER,
  "points" INTEGER NOT NULL DEFAULT 1,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "explanation" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionBankQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RubricCriterion" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "points" INTEGER NOT NULL DEFAULT 1,
  "levels" JSONB,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "RubricCriterion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Assessment_questionBankId_idx" ON "Assessment"("questionBankId");
CREATE INDEX IF NOT EXISTS "QuestionBank_organizationId_idx" ON "QuestionBank"("organizationId");
CREATE INDEX IF NOT EXISTS "QuestionBank_courseId_idx" ON "QuestionBank"("courseId");
CREATE INDEX IF NOT EXISTS "QuestionBankQuestion_questionBankId_type_idx" ON "QuestionBankQuestion"("questionBankId", "type");
CREATE INDEX IF NOT EXISTS "RubricCriterion_assessmentId_position_idx" ON "RubricCriterion"("assessmentId", "position");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Assessment_questionBankId_fkey') THEN
    ALTER TABLE "Assessment"
    ADD CONSTRAINT "Assessment_questionBankId_fkey"
    FOREIGN KEY ("questionBankId") REFERENCES "QuestionBank"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuestionBank_organizationId_fkey') THEN
    ALTER TABLE "QuestionBank"
    ADD CONSTRAINT "QuestionBank_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuestionBank_courseId_fkey') THEN
    ALTER TABLE "QuestionBank"
    ADD CONSTRAINT "QuestionBank_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuestionBankQuestion_questionBankId_fkey') THEN
    ALTER TABLE "QuestionBankQuestion"
    ADD CONSTRAINT "QuestionBankQuestion_questionBankId_fkey"
    FOREIGN KEY ("questionBankId") REFERENCES "QuestionBank"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RubricCriterion_assessmentId_fkey') THEN
    ALTER TABLE "RubricCriterion"
    ADD CONSTRAINT "RubricCriterion_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
