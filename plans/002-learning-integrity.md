# 002: Make learning completion and attempts reliable

Planned at `2033a49`, 2026-11-17. P1; effort M; risk MED; confidence HIGH. Depends on 001 permissions.

Baseline: submitAssessmentAction lacked enrolment checks, coerced missing answers to zero and independently counted/created attempts. markLessonCompleteAction never completed enrolment, while certificates required completion. Invalid lesson links substituted the first lesson.

Scope: learning actions/pages/data, assessment/certificate helpers, SCORM manifest selection and unit/real-Postgres tests. Do not implement or imply a complete SCORM or proctoring engine.

Steps: accept ACTIVE/COMPLETED enrolments or managers; validate every answer before consuming attempts. Use serializable transactions with bounded retry for attempts, lesson completion and certificates. Reconcile current lessons plus required assessment passes, preserving revoked access. Resolve exact lesson IDs; distinguish lesson progress from assessment/course completion. Honor supported feedback policies and disable unsupported time limits/scheduled feedback. Resolve SCORM default organisation resources.

Done criteria: `npm test`, `npm run test:integration` against a disposable `_verify` database after migrations, typecheck and lint pass. Real DB cases cover concurrent final attempts, final lessons, certificate uniqueness and cancelled enrolments. Stop before any cleanup against a nonverification database.

Maintenance: current requirements drive eligibility; historical certificates remain records. Curriculum versioning and historical-status backfills need explicit product decisions.
