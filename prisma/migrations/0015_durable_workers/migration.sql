ALTER TABLE "LearningEvent" ADD COLUMN "dispatchedAt" TIMESTAMP(3);
CREATE INDEX "LearningEvent_dispatchedAt_createdAt_idx" ON "LearningEvent"("dispatchedAt", "createdAt");
ALTER TABLE "AutomationRun" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "nextRetryAt" TIMESTAMP(3), ADD COLUMN "leaseToken" TEXT, ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
-- Preserve historic duplicate runs while preventing new duplicate rule/event work.
-- Historical duplicates lose only their rule association, never their delivery history.
WITH duplicates AS (
 SELECT "id", row_number() OVER (PARTITION BY "ruleId", "learningEventId" ORDER BY "createdAt", "id") AS rank
 FROM "AutomationRun" WHERE "ruleId" IS NOT NULL AND "learningEventId" IS NOT NULL
) UPDATE "AutomationRun" SET "ruleId" = NULL WHERE "id" IN (SELECT "id" FROM duplicates WHERE rank > 1);
CREATE UNIQUE INDEX "AutomationRun_ruleId_learningEventId_key" ON "AutomationRun"("ruleId", "learningEventId");
CREATE INDEX "AutomationRun_status_nextRetryAt_leaseExpiresAt_idx" ON "AutomationRun"("status", "nextRetryAt", "leaseExpiresAt");
ALTER TABLE "NotificationDelivery" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "NotificationDelivery_idempotencyKey_key" ON "NotificationDelivery"("idempotencyKey");
ALTER TABLE "WebhookEndpoint" ADD COLUMN "signingSecretEncrypted" TEXT;
-- A hash cannot sign. Existing endpoints must be recreated to provision an encrypted key.
UPDATE "WebhookEndpoint" SET "active" = false WHERE "signingSecretEncrypted" IS NULL;
ALTER TABLE "WebhookDelivery" ADD COLUMN "eventKey" TEXT, ADD COLUMN "leaseToken" TEXT, ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "WebhookDelivery_endpointId_eventKey_key" ON "WebhookDelivery"("endpointId", "eventKey");
CREATE TABLE "WebhookDeliveryAttempt" (
 "id" TEXT NOT NULL, "deliveryId" TEXT NOT NULL, "attempt" INTEGER NOT NULL,
 "statusCode" INTEGER, "error" TEXT, "durationMs" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "WebhookDeliveryAttempt_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "WebhookDeliveryAttempt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "WebhookDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WebhookDeliveryAttempt_deliveryId_attempt_key" ON "WebhookDeliveryAttempt"("deliveryId", "attempt");
