# Automations

Automation rules are organization-scoped and delivered by a separately supervised PostgreSQL worker. Enable or pause the four built-in recipes in `/dashboard/automations`; the page shows run attempts and notification outcomes.

## Start the worker

Apply migrations and generate Prisma before starting the new application and worker. Supply the same `DATABASE_URL` as the application, `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM`. Webhooks additionally require `WEBHOOK_ENCRYPTION_KEY` (see [Developer Platform](DEVELOPER_PLATFORM.md)). Keep secrets in the deployment secret store, never in source control.

```sh
npm run worker
# A single polling batch, useful for a scheduler or smoke check:
npm run worker -- --once
```

The command uses `tsx`, which must be installed in the worker runtime. It reads environment variables supplied by the process supervisor; it does not automatically load Next.js `.env.local`. Run it as a continuously supervised process with restart-on-failure and alerts for repeated batch errors. SIGTERM/SIGINT finish the current batch before disconnecting. It polls every two seconds, in batches of 25; multiple workers are supported. Trigger.dev credentials do not change execution mode.

## Transactional outbox

Persist a learning event in the **same database transaction** as its business mutation. This commits the mutation and its outbox event together; an outage cannot silently discard the event between those writes.

```ts
await prisma.$transaction(async (tx) => {
  // Perform the authorized business mutation using tx.
  await recordLearningEvent({
    organizationId, userId, courseId,
    type: "user.enrolled",
    payload: { email, userName, courseTitle },
    idempotencyKey: `enrollment:${userId}:${courseId}`,
  }, tx);
});
```

`recordLearningEvent` sends nothing. The worker atomically marks each event dispatched and creates matching runs plus subscribed webhook deliveries. A rollback leaves the event undispatched. Database uniqueness prevents duplicate rule/event runs and endpoint/event deliveries. Organization-less events use a stable hash-derived ID when an idempotency key is supplied; they are retained but do not fan out to organization rules.

Only enable a rule once you intend new events to trigger it. Historic events from before the worker migration are marked dispatched; they are not bulk replayed. Existing pending runs remain eligible, and interrupted legacy inline runs receive a recoverable lease. Legacy sent notifications receive deduplication keys so recovery does not resend them.

## Delivery and retries

Each run is claimed with an atomic conditional update, a unique lease token, and a 60-second lease. Email requests have a 15-second timeout. Only the lease owner can finish a run. Expired claims become eligible again; an expired final claim becomes visibly failed. Provider failures retry up to five attempts with delays of 30, 60, 120, and 240 seconds. The worker does not treat `FAILED` as perpetually retryable.

Each run has one notification row and sends a stable `automation:<run ID>` provider idempotency key. A persisted `SENT` result is never resent by recovery. Delivery is **at least once** across process crashes; provider idempotency retention is finite (Resend currently 24 hours). A crash after provider acceptance but before recording success can produce an uncertain outcome after that retention period. Inspect provider records before manually recovering very old attempts; this is not an unconditional exactly-once guarantee.

Provider errors are stored as fixed diagnostics, not raw response bodies. Stub email is marked `SKIPPED`, never `SENT`; production requires a real provider. Pausing or deleting a rule skips queued runs that have not started executing.

## Built-in recipes

| Recipe | Event | Delivery |
| --- | --- | --- |
| Enrollment welcome | `user.enrolled` | Enrollment confirmation |
| Course completion | `course.completed` | Completion congratulations |
| Certificate issued | `certificate.issued` | Certificate availability notice |
| Learner inactivity | `learner.inactive` | Reminder to resume learning |

All four have actual text and escaped HTML templates. Every hour, including worker startup, the inactivity scanner pages through active enrollments in published organization courses. It uses the latest lesson activity, falling back to enrollment time, and the rule's `inactiveDays` (default 7; allowed 1–365). It queues one nudge per inactivity episode and rule; new activity permits a future nudge after another inactivity period. Completed/refunded/cancelled enrollments are excluded. The scanner and fanout are idempotent across concurrent workers. Template editing and scheduling preferences are not yet exposed in the UI.

## Verification

Focused unit tests exercise all recipes, deduplication, retry scheduling, stub honesty and destination policy. `tests/integration/durable-workers.test.ts` uses a disposable PostgreSQL database ending in `_verify` and mocked external transports to verify transaction rollback, race-safe fanout and claims, stale lease recovery, retries, signatures, attempt records, and organization-scoped replay. No test sends real email or outbound webhooks.

Monitor pending event age, pending/run retry age, repeated `FAILED` outcomes, and the supervisor's process health. The UI reports persisted delivery state; it does not claim that a worker process is alive merely because configuration is present.
