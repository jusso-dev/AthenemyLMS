# Automations

Athenemy has a persisted automation foundation for learning operations, notifications, and future webhook delivery.

## Product Surface

Automation status lives at `/dashboard/automations`.

The page shows:

- Trigger.dev configuration readiness
- built-in recipe definitions
- recent automation runs
- recent notification delivery state

## Data Model

The automation foundation stores first-party state in Postgres:

- `LearningEvent`: product events such as enrollment, lesson completion, certificate issued, payment state, and inactivity signals.
- `AutomationRule`: organization-scoped trigger/action configuration.
- `AutomationRun`: an evaluated rule for a specific event.
- `NotificationDelivery`: delivery state for email, in-app, or future channels.
- `WebhookEndpoint` and `WebhookDelivery`: outbound integration records.

This keeps Athenemy portable. Trigger.dev can orchestrate background execution, but it is not the source of truth.

## Helpers

Automation helpers live in `src/lib/automations/events.ts`.

Use `recordLearningEvent` to create an idempotent event, queue matching
automation runs, and dispatch each through the execution boundary:

```ts
await recordLearningEvent({
  organizationId,
  userId,
  courseId,
  type: "user.enrolled",
  payload: { courseTitle, email },
  idempotencyKey: `enrollment:${userId}:${courseId}`,
});
```

## Execution Boundary

`src/lib/automations/dispatcher.ts` is the seam between an automation run and
its executor.

- `dispatchAutomationRun(runId)` is the entry point called after an
  `AutomationRun` row is created.
- `processAutomationRun(runId)` is the in-process executor. It loads the run,
  rule, and learning event, advances the run through `PENDING -> RUNNING ->
  SUCCEEDED | FAILED | SKIPPED`, and writes a `NotificationDelivery` row for
  email actions.

## Execution Modes

| Mode | When | Behaviour |
| --- | --- | --- |
| `inline` (default) | `TRIGGER_SECRET_KEY` / `TRIGGER_API_KEY` not set | Runs are processed synchronously inside the request that produced the event. Failures are caught so the original product action still succeeds. |
| `trigger.dev` | One of the env vars is set | The boundary is ready to hand runs off to `trigger.tasks.processAutomationRun.trigger({ runId })`. The SDK wiring lands in Phase 2 of #37; until then this mode also falls back to inline processing. |

The current mode is surfaced on `/dashboard/automations` so operators can see
which executor is in use.

## Built-In Recipes

| Recipe | Event | Action | Phase 1 behaviour |
| --- | --- | --- | --- |
| Enrollment welcome | `user.enrolled` | `email.enrollment_welcome` | Sends an enrollment email via the email provider and records a `NotificationDelivery`. |
| Course completion | `course.completed` | `email.course_completion` | Records a PENDING delivery; template handler ships in Phase 2. |
| Certificate issued | `certificate.issued` | `email.certificate_issued` | Records a PENDING delivery; template handler ships in Phase 2. |
| Learner inactivity nudge | `learner.inactive` | `email.inactivity_nudge` | Records a PENDING delivery; template handler ships in Phase 2. |

Recipe definitions are currently code-level defaults. Editable admin controls
ship with Phase 4 of #37.

## Trigger.dev Roadmap

Phase 2 of #37 will add `@trigger.dev/sdk`, a `trigger.config.ts`, and one
`processAutomationRun` task. The boundary in `dispatcher.ts` keeps the rest
of the codebase stable through that change.
