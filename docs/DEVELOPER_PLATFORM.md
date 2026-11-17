# Developer Platform

Athenemy exposes a developer platform for integrations, reporting, provisioning, and webhook consumers.

## Admin UI

Developer tools live at `/dashboard/developer`.

Organization admins can:

- create API keys
- select scopes
- see key prefixes and status
- create webhook endpoint records
- choose subscribed event types
- inspect delivery status, retry timing, and individual attempt history
- replay failed deliveries within their organization

API keys and webhook secrets are shown once at creation time. API keys are stored as hashes. Webhook signing secrets also require recoverable storage: they are encrypted using AES-256-GCM with organization-bound authenticated data; API responses never return the encrypted value or hash.

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

Delivery is handled by `npm run worker` (see [Automations](AUTOMATIONS.md)), with atomic database claims, 60-second leases, five attempts, and exponential backoff. Each attempt is recorded before network delivery, so an interrupted attempt remains visible with an unknown outcome. Success requires a 2xx response. Network failures, 408, 429, and 5xx responses retry; other responses, including redirects, fail without following the redirect.

Configure `WEBHOOK_ENCRYPTION_KEY` as a base64-encoded random 32-byte key in the worker and application secret store. Endpoint creation fails closed without it. Preserve this key across restarts and backups; changing it without re-encrypting existing secrets makes those endpoints undeliverable. Existing endpoints created before encrypted signing-key storage are disabled by migration and must be recreated; their one-way hashes cannot be recovered. Never expose this encryption key to recipients.

Destinations must use HTTPS on port 443 without embedded credentials or fragments. Creation/update and every delivery resolve DNS and reject non-public addresses. The socket is pinned to a validated address while retaining TLS hostname verification; redirects are never followed. DNS and HTTP operations have five- and fifteen-second deadlines. This release intentionally supports public IPv4 destinations only; IPv6-only and mixed IPv4/IPv6 DNS answers are rejected. Use a dedicated public IPv4 receiver hostname if needed. Request payloads are capped at 256 KB, and receiver response bodies are discarded.

The worker maps `user.enrolled` learning events to `enrollment.created`, with course, assessment, certificate and payment events retaining their names. Event fanout is transactional and deduplicated by endpoint and event ID. The catalog exposes implemented producers only. Identity, invitation and publishing events are not offered until those flows have transactional producers.

Admin replay queues a new delivery while preserving the original payload and event ID. Duplicate replay clicks return the same queued replay. Its attempts are separate, and it must belong to the authenticated administrator's organization and an active endpoint. Receivers must deduplicate by payload `id`; successful delivery is at least once, not exactly once. Read-only attempts are shown in the developer dashboard; raw response bodies are never stored.

Implemented event catalog:

- `enrollment.created`
- `lesson.completed`
- `assessment.passed`
- `assessment.failed`
- `course.completed`
- `certificate.issued`
- `payment.succeeded`
- `payment.failed`
- `payment.refunded`
- `payment.disputed`

Webhook signatures use the timestamped header format:

```text
t=1715900000,v1=<hmac-sha256>
```

The header name is `x-athenemy-signature`. Verify HMAC-SHA256 over the exact raw body prefixed with `<timestamp>.`, compare signatures using a constant-time function, and enforce a short timestamp tolerance. `x-athenemy-delivery-id` identifies the delivery attempt group; payload `id` is stable across retries and manual replay. Preserve the raw request bytes when verifying signatures.
