# 003: Fulfil settled purchases and store validated media durably

Planned at `2033a49`, 2026-11-17. P1; effort M; risk MED; confidence HIGH. Depends on 001.

Baseline: Stripe webhook fulfilled unpaid sessions and duplicated notification sends. Upload completion trusted declared MIME/size/filename. API pagination allowed nonintegers and unexpected errors exposed internal messages.

Scope: Stripe routes/email, upload routes/assets/R2/validation, API response helper, additive payment checkpoint migration and tests. No live financial, email or object-store actions.

Steps: match persisted purchase details, settle confirmed payments only, process asynchronous outcomes and condition state transitions. Preserve completed/refunded states and checkpoint each email with provider idempotency. Bound/decode/reencode actual PNG/JPEG/WebP bytes, derive extensions, use R2 in production and clean up failed persistence. Validate JSON/pagination and hide internal errors; preserve retryable webhook failures.

Done criteria: unit cases cover unpaid/paid/failed/duplicate events, email retries, real image decoding, production storage and malformed API input; typecheck/build pass; additive migration deploys on disposable Postgres. Stop on destructive migration or required real financial action.

Maintenance: provider retention bounds crash-after-send deduplication; no unlimited exactly-once claim. Document webhook API version and subscriptions. Refund/dispute policy remains an operational requirement.
