# Integrated LMS workflows

User requested completion of the remaining fixes and full local end-to-end testing
with subagents. No staging environment exists; all verification is local.

- Persist assessment start/resume/deadline, reserve attempts, record expiry, enforce
  scheduled feedback, and emit transactional result events.
- Import bounded single-SCO SCORM 1.2 ZIPs into private storage; run content in an
  opaque-origin sandbox; validate CMI commits, resume state/time, revoke stale
  sessions, and gate lesson/course/certificate completion.
- Implement PostgreSQL outbox fanout, leased worker jobs, retry/backoff/recovery,
  email templates, encrypted webhook signing secrets, delivery attempts/replay,
  and scoped management. Backfill legacy work without mass resends.
- Handle partial/full refunds and dispute resolution with monotonic state and
  carefully scoped access restoration. Record learning/payment events atomically.
- Paginate public catalogues and analytics details while retaining full totals;
  aggregate lesson progress in SQL and keep currencies separate after refunds.
- Exercise real PostgreSQL and browser workflows through a temporary app copy with
  fixture identity, without introducing a production authentication bypass.

Review includes schema/migration replay, all changed source/tests/scripts/config,
local external-provider contracts, and remaining documented operational limits.
Current results are in [Production readiness](../docs/PRODUCTION_READINESS.md).
