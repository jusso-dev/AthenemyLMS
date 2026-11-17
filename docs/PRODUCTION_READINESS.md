# Production readiness review

Reviewed 2026-11-17 against baseline `2033a49`, using the [shadcn/improve](https://github.com/shadcn/improve) audit workflow. Findings and implementation scope: [plans](../plans/README.md). The follow-up implements the remaining assessment, SCORM, worker, reversal and query fixes and verifies integrated workflows locally, as requested. No staging environment or live provider accounts were used; this is not a production deployment certification.

## LMS references and resulting decisions

- [Moodle activity completion](https://docs.moodle.org/503/en/Activity_completion) makes activity requirements visible, while [course completion](https://docs.moodle.org/503/en/Course_completion) reports criteria-based completion. Athenemy now distinguishes lesson progress, required assessment passes and overall completion; certificates verify actual completed work.
- [Canvas modules](https://community.instructure.com/en/instructure/kb/articles/662761-what-are-modules) organise content and requirements; [prerequisite changes](https://community.instructure.com/en/kb/articles/660896-how-do-i-add-prerequisites-to-a-module) explicitly consider existing learners. Athenemy retains its simpler section/lesson model and exact resume navigation. Versioned prerequisites and relocking are future decisions, not implied capabilities.
- [Open edX learner progress](https://docs.openedx.org/en/latest/learners/SFD_check_progress.html) separates course progress and grading feedback. Athenemy now exposes attempt counts, passing thresholds, remaining required work and supported feedback policies with persisted timed attempts and scheduled feedback.

## Implemented controls

- Organisation creation preserves platform roles. `PLATFORM_ADMIN_CLERK_IDS` is the only source of global administrator grants, including for legacy database ADMIN rows. Organisation owners/admins retain membership-scoped authoring permissions.
- Organisation member removal preserves the identity and unrelated memberships/history. It cancels access only to courses in that organisation. The last owner cannot be removed/demoted, and invitations do not overwrite an existing member's role.
- ACTIVE/COMPLETED enrolments govern learning reads/writes; cancelled/refunded access is denied. Missing answers cannot receive credit. Attempt allocation and completion use serializable transactions with bounded retries. Certificates recheck current requirements and issue idempotently.
- Stripe purchases require settled payment and matching persisted purchase details. Delayed success/failure events are handled, duplicate settlement preserves completion, and per-email checkpoints plus provider keys reduce duplicate notifications.
- Images are request-size/pixel bounded, decoded and reencoded, assigned canonical extensions, and stored in R2 in production. Local public-directory uploads are development only. Failed database persistence triggers object cleanup.
- Presigned uploads require author access, file size and allowed MIME type. API pagination validates integers; unexpected API/database diagnostics are withheld from user-facing errors.
- Configured database failures now reach retryable error boundaries rather than being disguised as empty catalogues or setup states. Metrics use actual data and accurate time-range labels. Invalid course forms are cancelled synchronously and display accessible errors. Keyboard skip links target actual main content on desktop/mobile. Automation status describes durable database-worker execution and distinguishes real delivery from skipped stubs.
- Next.js is patched to 16.4.6. Compatible dependencies were refreshed. The Prisma configuration dependency `deepmerge-ts` is overridden to patched 8.x; Prisma remains 6.19.3. Generation, migrations and real DB transactions verify compatibility. Five existing timestamp defaults in the Prisma schema now match migration history.
- Production startup checks configuration; dashboard and onboarding rendering stay dynamic even when build-time secrets are absent. GitHub-hosted CI runs unit/integration tests, migrations, build, browser checks and dependency audit. No CodeBuild is used.

- Timed assessments persist start/resume/deadlines, reserve attempts and record expiry server-side. Required assessment and attached SCORM requirements gate certificates; feedback can wait until a closing time.
- SCORM ZIPs are bounded, validated and stored privately; executable package content uses an opaque-origin sandbox, scoped launch capabilities and authenticated CMI commits. Resume, scores, session time, stale-session invalidation and current completion requirements are tested.
- Durable workers atomically fan out outbox events, lease jobs, retry with backoff, recover interrupted work, deliver actual email templates and sign outgoing webhooks. Management/replay is tenant-scoped; secrets are encrypted at rest and destination validation pins public IPv4 sockets.
- Partial/full refunds and dispute outcomes update payment/access state transactionally. Stale events cannot regress refunds or reopen cancelled access; delayed failures emit their outbox event once; another valid purchase preserves access. Learning/payment events commit with their mutations.
- Catalogues and instructor detail rows paginate at 24 items. Full-scope analytics use database aggregation and keep net revenue separate by currency. Manual/API enrolment preserves completion and constrains learner selection to authorized tenants.

## Verification

Final local verification:

- **263 unit tests across 43 files passed.**
- **40 PostgreSQL integration tests across 8 files passed.** These cover concurrent assessment submissions/completion, SCORM requirements/resume/revocation, signed Stripe settlement/refund/dispute events, durable worker claims/recovery, tenant-scoped enrolment, and catalogue/analytics fixtures spanning multiple pages.
- **34 desktop/mobile Playwright tests passed:** 28 setup/navigation/accessibility checks and six full authenticated application workflows. The latter exercise instructor authoring/publishing → enrolment → lesson → timed assessment/resume → certificate/PDF, expiry/revoked access, and SCORM import → sandboxed launch → save/resume → completion.
- ESLint, TypeScript and the production Next.js build passed. Dashboard/onboarding routes remain dynamic.
- **23 migrations** applied to a fresh disposable local database. Database-to-schema comparison reported **no difference**; the complete migration chain also replayed in a shadow database. Prisma validation/generation passed.
- `npm audit --audit-level=low`: **zero reported vulnerabilities**.
- Production preflight validates the worker encryption key and private SCORM volume in addition to provider/database settings. Its tests exercise complete and incomplete configurations without exposing supplied values. Local production startup correctly refuses absent production configuration.
- Worker CLI single-batch smoke check passed with local data and no live sends.
- Deliberate review covered source, new files, tests, migrations/backfills, scripts, configuration and documentation. It caught and fixed multi-purchase dispute restoration, proxy-origin handling, stale worker writes, tenant directory exposure, and learner progress after adding required SCORM work. `git diff --check` passed.

The browser harness copies the application into a temporary directory and replaces only the Clerk identity boundary there. It binds to loopback, accepts only run-scoped persisted fixtures, receives no provider credentials, and never modifies production authentication. PostgreSQL, forms/actions, package extraction, browser sandboxing and PDF generation are real. Stripe event signatures are generated and verified by the actual SDK locally; email/R2/outbound delivery boundaries use controlled fixtures/mocks. External account configuration and real delivery are outside these local results.

## Release requirements

1. Configure the production environment and run `npm run check:production`. Supply PostgreSQL, Clerk, R2 and Resend configuration, real HTTPS application/media URLs, and a verified sender. Stripe may remain disabled for a free-only installation; partial Stripe configuration is rejected. Set a shared persistent private `SCORM_STORAGE_DIR` and a stable base64 32-byte `WEBHOOK_ENCRYPTION_KEY`. Supervise `npm run worker` alongside the app with the same database and delivery configuration. The check validates presence/shape, not connectivity or domain ownership.
2. Set `PLATFORM_ADMIN_CLERK_IDS` to trusted operator identities. Existing database ADMIN rows no longer grant platform rights on their own. Audit prior privilege grants and activity; code fixes cannot establish whether earlier access was misused.
3. Back up production, test restoration, then apply migrations with `npm run db:deploy` before release. Migrations 0012–0018 add notification checkpoints, timed attempts, SCORM sessions, worker claims/history, payment reversals and legacy backfills. Legacy SCORM registrations without stored assets require re-import; old hashed-only webhook endpoints require recreation. Do not reset the database or run development migrations in production.
4. Configure Stripe webhooks for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, and `charge.dispute.closed`. Align the endpoint with API version `2026-08-26.dahlia`. Verify signed event delivery, delayed settlement, retry behavior and an actual test purchase with your account.
5. Verify Clerk sign-in/invitations and the platform/tenant role matrix, R2 permissions/CORS/public media URLs, and Resend delivery. Run learner enrolment → lessons → required assessment → certificate plus member-removal scenarios using separate test accounts.
6. Configure request/body limits, rate limiting, observability, incident alerts, backup retention and a restore drill for the actual host. Run realistic-volume/load tests before making capacity commitments.

## Remaining limitations

- Live Clerk, Stripe, R2, Resend, production hosting, backups/restore and production-scale capacity were not tested. The user requested local verification only.
- SCORM is a documented **single-SCO SCORM 1.2 subset**, with asynchronous durable save acknowledgement and an eight-hour launch session. It requires a shared persistent private volume. No complete SCORM certification, SCORM 2004, xAPI or LTI execution is claimed.
- Durable delivery is at least once; provider deduplication retention is finite. A crash after acceptance but before persistence may duplicate delivery after that window. Webhooks currently support destinations resolving exclusively to public IPv4 addresses.
- Draft assessment answers are not autosaved across refreshes. Feedback visibility does not postpone course completion, so completion may reveal that an assessment passed.
- Subscription/bundle/coupon fulfilment and some enterprise foundations remain outside the implemented course-purchase workflows. Refunds are initiated in Stripe; the application processes their signed state transitions.
- Historical certificates remain records of past achievement. Curriculum versioning, bulk reconciliation and prerequisite relocking need a separate policy. Some administrative directories remain bounded pickers or unpaginated views; no institutional-scale capacity claim is made.
- ESLint 9 remains on the compatible tooling major and is deprecated upstream, with no current advisory in the verified dependency tree.
