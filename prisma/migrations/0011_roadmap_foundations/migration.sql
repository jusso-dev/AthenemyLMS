CREATE TYPE "AutomationRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'RETRYING');
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "CohortStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "DiscussionPostStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'DELETED');
CREATE TYPE "LiveSessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENT', 'AMOUNT');

ALTER TABLE "Course"
  ADD COLUMN "sourceTemplateId" TEXT,
  ADD COLUMN "sourceTemplateVersion" INTEGER,
  ADD COLUMN "templateCategory" TEXT,
  ADD COLUMN "requiredForMembers" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "autoEnrollMembers" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "autoEnrollFutureMembers" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "CourseTemplate" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "lessons" JSONB NOT NULL,
  "assessment" JSONB,
  "certificatesEnabled" BOOLEAN NOT NULL DEFAULT true,
  "suggestedDurationMinutes" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "requiredSuggestion" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiKey" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdById" TEXT,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEndpoint" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "eventTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "lastDeliveryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookDelivery" (
  "id" TEXT NOT NULL,
  "endpointId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "statusCode" INTEGER,
  "responseSummary" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER,
  "nextRetryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "userId" TEXT,
  "courseId" TEXT,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationRule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationRun" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ruleId" TEXT,
  "learningEventId" TEXT,
  "status" "AutomationRunStatus" NOT NULL DEFAULT 'PENDING',
  "triggerDevRunId" TEXT,
  "error" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "automationRunId" TEXT,
  "channel" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "metadata" JSONB,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomOrganizationRole" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomOrganizationRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationPrivacySettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "allowPublicCatalog" BOOLEAN NOT NULL DEFAULT true,
  "allowPublicCertificates" BOOLEAN NOT NULL DEFAULT true,
  "requireMfaForAdmins" BOOLEAN NOT NULL DEFAULT false,
  "dataRetentionDays" INTEGER,
  "exportTrainingRecordsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationPrivacySettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseBundle" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseBundle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseBundleItem" (
  "id" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CourseBundleItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceCoupon" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "discountType" "CouponDiscountType" NOT NULL,
  "percentOff" INTEGER,
  "amountOffCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "maxRedemptions" INTEGER,
  "redemptionCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceCoupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Cohort" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "capacity" INTEGER,
  "status" "CohortStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CohortMembership" (
  "id" TEXT NOT NULL,
  "cohortId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CohortMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscussionThread" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "lessonId" TEXT,
  "cohortId" TEXT,
  "title" TEXT NOT NULL,
  "pinnedPostId" TEXT,
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscussionThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscussionPost" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "parentId" TEXT,
  "body" TEXT NOT NULL,
  "status" "DiscussionPostStatus" NOT NULL DEFAULT 'VISIBLE',
  "isAnswer" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscussionPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveSession" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "cohortId" TEXT,
  "instructorId" TEXT,
  "title" TEXT NOT NULL,
  "providerUrl" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 60,
  "recordingUrl" TEXT,
  "status" "LiveSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseTemplate_slug_key" ON "CourseTemplate"("slug");
CREATE INDEX "CourseTemplate_category_locale_idx" ON "CourseTemplate"("category", "locale");
CREATE INDEX "Course_organizationId_requiredForMembers_idx" ON "Course"("organizationId", "requiredForMembers");
CREATE INDEX "Course_sourceTemplateId_idx" ON "Course"("sourceTemplateId");
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_organizationId_revokedAt_idx" ON "ApiKey"("organizationId", "revokedAt");
CREATE INDEX "ApiKey_keyPrefix_idx" ON "ApiKey"("keyPrefix");
CREATE INDEX "WebhookEndpoint_organizationId_active_idx" ON "WebhookEndpoint"("organizationId", "active");
CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId", "createdAt");
CREATE INDEX "WebhookDelivery_status_nextRetryAt_idx" ON "WebhookDelivery"("status", "nextRetryAt");
CREATE UNIQUE INDEX "LearningEvent_organizationId_idempotencyKey_key" ON "LearningEvent"("organizationId", "idempotencyKey");
CREATE INDEX "LearningEvent_organizationId_type_createdAt_idx" ON "LearningEvent"("organizationId", "type", "createdAt");
CREATE INDEX "LearningEvent_userId_createdAt_idx" ON "LearningEvent"("userId", "createdAt");
CREATE INDEX "LearningEvent_courseId_createdAt_idx" ON "LearningEvent"("courseId", "createdAt");
CREATE INDEX "AutomationRule_organizationId_enabled_eventType_idx" ON "AutomationRule"("organizationId", "enabled", "eventType");
CREATE INDEX "AutomationRun_organizationId_status_createdAt_idx" ON "AutomationRun"("organizationId", "status", "createdAt");
CREATE INDEX "AutomationRun_ruleId_createdAt_idx" ON "AutomationRun"("ruleId", "createdAt");
CREATE INDEX "NotificationDelivery_organizationId_status_createdAt_idx" ON "NotificationDelivery"("organizationId", "status", "createdAt");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE UNIQUE INDEX "CustomOrganizationRole_organizationId_name_key" ON "CustomOrganizationRole"("organizationId", "name");
CREATE UNIQUE INDEX "OrganizationPrivacySettings_organizationId_key" ON "OrganizationPrivacySettings"("organizationId");
CREATE UNIQUE INDEX "CourseBundle_organizationId_slug_key" ON "CourseBundle"("organizationId", "slug");
CREATE INDEX "CourseBundle_organizationId_status_idx" ON "CourseBundle"("organizationId", "status");
CREATE UNIQUE INDEX "CourseBundleItem_bundleId_courseId_key" ON "CourseBundleItem"("bundleId", "courseId");
CREATE INDEX "CourseBundleItem_courseId_idx" ON "CourseBundleItem"("courseId");
CREATE UNIQUE INDEX "CommerceCoupon_organizationId_code_key" ON "CommerceCoupon"("organizationId", "code");
CREATE INDEX "CommerceCoupon_organizationId_active_idx" ON "CommerceCoupon"("organizationId", "active");
CREATE INDEX "Cohort_organizationId_status_idx" ON "Cohort"("organizationId", "status");
CREATE INDEX "Cohort_courseId_status_idx" ON "Cohort"("courseId", "status");
CREATE UNIQUE INDEX "CohortMembership_cohortId_userId_key" ON "CohortMembership"("cohortId", "userId");
CREATE INDEX "CohortMembership_userId_idx" ON "CohortMembership"("userId");
CREATE INDEX "DiscussionThread_organizationId_createdAt_idx" ON "DiscussionThread"("organizationId", "createdAt");
CREATE INDEX "DiscussionThread_courseId_lessonId_idx" ON "DiscussionThread"("courseId", "lessonId");
CREATE INDEX "DiscussionPost_threadId_createdAt_idx" ON "DiscussionPost"("threadId", "createdAt");
CREATE INDEX "DiscussionPost_authorId_createdAt_idx" ON "DiscussionPost"("authorId", "createdAt");
CREATE INDEX "LiveSession_organizationId_startsAt_idx" ON "LiveSession"("organizationId", "startsAt");
CREATE INDEX "LiveSession_courseId_startsAt_idx" ON "LiveSession"("courseId", "startsAt");

ALTER TABLE "Course" ADD CONSTRAINT "Course_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "CourseTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_learningEventId_fkey" FOREIGN KEY ("learningEventId") REFERENCES "LearningEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_automationRunId_fkey" FOREIGN KEY ("automationRunId") REFERENCES "AutomationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomOrganizationRole" ADD CONSTRAINT "CustomOrganizationRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationPrivacySettings" ADD CONSTRAINT "OrganizationPrivacySettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseBundle" ADD CONSTRAINT "CourseBundle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseBundleItem" ADD CONSTRAINT "CourseBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "CourseBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseBundleItem" ADD CONSTRAINT "CourseBundleItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceCoupon" ADD CONSTRAINT "CommerceCoupon_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CohortMembership" ADD CONSTRAINT "CohortMembership_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CohortMembership" ADD CONSTRAINT "CohortMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiscussionPost" ADD CONSTRAINT "DiscussionPost_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DiscussionThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscussionPost" ADD CONSTRAINT "DiscussionPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
