-- Do not deliver historic events to endpoints/rules created after the worker rollout.
DO $$
BEGIN
 IF to_regclass('"_prisma_migrations"') IS NOT NULL THEN
  EXECUTE $backfill$
   UPDATE "LearningEvent" SET "dispatchedAt" = "createdAt"
   WHERE "dispatchedAt" IS NULL AND "createdAt" <= (
    SELECT "started_at" AT TIME ZONE 'UTC' FROM "_prisma_migrations"
    WHERE "migration_name" = '0015_durable_workers' AND "rolled_back_at" IS NULL
    ORDER BY "started_at" DESC LIMIT 1
   )
  $backfill$;
 END IF;
END $$;
-- Legacy inline workers had no lease. Permit durable recovery of interrupted runs.
UPDATE "AutomationRun" SET "leaseExpiresAt" = CURRENT_TIMESTAMP
WHERE "status" = 'RUNNING' AND "leaseExpiresAt" IS NULL;
-- Preserve history; assign only the accepted/most recent row the stable run key.
WITH preferred AS (
 SELECT "id", "automationRunId", row_number() OVER (
  PARTITION BY "automationRunId"
  ORDER BY CASE WHEN "status" = 'SENT' THEN 0 ELSE 1 END, "createdAt" DESC, "id"
 ) AS rank FROM "NotificationDelivery"
 WHERE "automationRunId" IS NOT NULL AND "idempotencyKey" IS NULL
 AND NOT EXISTS (
  SELECT 1 FROM "NotificationDelivery" other
  WHERE other."idempotencyKey" = 'automation:' || "NotificationDelivery"."automationRunId"
 )
)
UPDATE "NotificationDelivery" SET "idempotencyKey" = 'automation:' || preferred."automationRunId"
FROM preferred WHERE "NotificationDelivery"."id" = preferred."id" AND preferred.rank = 1;
