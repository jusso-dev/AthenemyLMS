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

Use `recordLearningEvent` to create an idempotent event and enqueue matching automation runs:

```ts
await recordLearningEvent({
  organizationId,
  userId,
  courseId,
  type: "user.enrolled",
  payload: { courseTitle },
  idempotencyKey: `enrollment:${userId}:${courseId}`,
});
```

## Built-In Recipes

Current recipe definitions:

- Enrollment welcome
- Course completion
- Certificate issued
- Learner inactivity nudge

Recipe definitions are currently code-level defaults. Editable admin controls and real task execution are follow-up work.

## Trigger.dev

Set `TRIGGER_SECRET_KEY` or `TRIGGER_API_KEY` to mark Trigger.dev as configured in the UI. Future task files should call into the same event/rule/run helpers instead of bypassing the database.
