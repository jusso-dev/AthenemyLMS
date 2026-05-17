# Developer Platform

Athenemy exposes a first-pass developer platform for integrations, reporting, provisioning, and webhook consumers.

## Admin UI

Developer tools live at `/dashboard/developer`.

Organization admins can:

- create API keys
- select scopes
- see key prefixes and status
- create webhook endpoint records
- choose subscribed event types
- see recent webhook delivery counts

API keys and webhook secrets are shown once at creation time. Stored values are hashed.

## API Authentication

Use organization API keys with a bearer token:

```bash
curl \
  -H "Authorization: Bearer ath_..." \
  http://localhost:3000/api/v1/me
```

API key helpers live in `src/lib/developer/api-keys.ts`.

Supported scopes:

- `org:read`
- `members:read`
- `members:write`
- `courses:read`
- `enrollments:read`
- `enrollments:write`
- `progress:read`
- `assessments:read`
- `certificates:read`
- `webhooks:read`
- `webhooks:write`
- `analytics:read`

## Current Endpoints

- `GET /api/v1/me`
- `GET /api/v1/courses`
- `GET /api/v1/courses/:courseId`
- `GET /api/v1/enrollments`
- `POST /api/v1/enrollments`
- `GET /api/v1/progress?courseId=...&userId=...`
- `GET /api/v1/certificates`
- `GET /api/v1/certificates/:certificateId`
- `GET /api/v1/portal/courses`
- `GET /api/v1/webhook-endpoints`
- `POST /api/v1/webhook-endpoints`
- `PATCH /api/v1/webhook-endpoints/:endpointId`
- `DELETE /api/v1/webhook-endpoints/:endpointId`

List endpoints use cursor-style pagination with `limit` and `cursor` where implemented.

## Error Shape

API errors use a stable envelope:

```json
{
  "error": {
    "code": "permission_denied",
    "message": "This API key requires the courses:read scope.",
    "requestId": "req_..."
  }
}
```

Responses include `x-request-id` and basic rate-limit headers.

## Webhooks

Webhook helpers live in `src/lib/developer/webhooks.ts`.

Current foundations include:

- organization-scoped endpoint records
- selected event subscriptions
- one-time webhook secret generation
- HMAC payload signing helpers
- delivery queue records via `WebhookDelivery`

Delivery execution, retries, replay, and delivery-detail UI are still follow-up work.

Initial event catalog:

- `user.created`
- `organization.member.created`
- `organization.invitation.created`
- `course.published`
- `enrollment.created`
- `lesson.completed`
- `assessment.submission.created`
- `assessment.passed`
- `assessment.failed`
- `course.completed`
- `certificate.issued`
- `payment.succeeded`
- `payment.failed`

Webhook signatures use the timestamped header format:

```text
t=1715900000,v1=<hmac-sha256>
```
