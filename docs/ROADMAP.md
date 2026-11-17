# Roadmap

## Implemented Foundations

- Default course library with editable starter courses and onboarding selection.
- Branded organization portal builder and public organization routes.
- Course authoring, rich lesson content, video URLs, R2-hosted video uploads, assessments, completion gates, certificates, import/export, and lifecycle controls.
- Organization tenancy with memberships, invitations, role-aware dashboards, and portal media assets.
- Developer platform foundation with organization API keys, scoped `/api/v1` endpoints, webhook endpoint records, and webhook signing helpers.
- Durable PostgreSQL automation worker with four configurable recipes, signed webhook delivery, retry/recovery, attempt history and scoped replay.
- Timed assessments, scheduled feedback, single-SCO SCORM 1.2 runtime, payment reversals and paginated aggregate analytics.
- Enterprise readiness foundation with audit logs, custom role capability presets, and privacy settings.
- Commerce foundation with bundles and coupons alongside existing Stripe checkout and billing portal flows.
- Social learning foundation with cohorts, discussions, and live sessions.

## Remaining Work

- Extend recipe controls with custom templates and scheduling preferences.
- Extend webhook transport support beyond public IPv4 and expand transactional event producers.
- Expand public API coverage and keep the existing OpenAPI spec aligned with supported routes.
- Add API request logging and admin-side revoke/rotation controls for API keys.
- Add full commerce checkout flows for bundles, coupon redemption, subscriptions, and affiliate attribution.
- Add cohort creation/edit forms, discussion posting UI, moderation controls, announcements, and live-session attendance.
- Add enterprise export flows, custom role assignment UI, MFA policy integration, and retention enforcement.
- Decide whether R2 direct video files are enough or Cloudflare Stream/adaptive playback is needed.
- Continue accessibility audits as dashboard surface area grows.

## MVP Gaps

The current MVP establishes routes, schema, setup docs, and integration seams. Management screens now use persisted data surfaces and empty setup states until Supabase is configured.
