# 004: Make release checks and UI states trustworthy

Planned at `2033a49`, 2026-11-17. P1; effort M; risk MED; confidence HIGH. Verify after 001–003.

Baseline: critical/high dependency advisories; CI omitted build/browser/database tests. Metrics and integration status were misleading, async form cancellation too late, and skip navigation ineffective.

Scope: packages/config, analytics/forms/landmarks/progress, automation states, CI, production preflight and docs. Preserve design tokens and simple learning-first interface.

Steps: patch dependencies without forcing database architecture migration, explicitly depend on the image decoder, scope Prisma's patched merge override. Verify generation/migrations. Use real metrics, synchronous validation with accessible errors, working skip focus and truthful unavailable states. Add GitHub-hosted Postgres/build/browser/audit gates. Production start validates service configuration; dashboard/onboarding remain dynamic when build secrets are absent.

Done criteria: clean install, generation, lint/typecheck/unit tests, real Postgres integration/migration/schema-drift checks, production build, desktop/mobile E2E and dependency audit all pass. Preflight rejects missing configuration without printing values. Review final changed/new files. No CodeBuild or deployment.

Maintenance: retain override until Prisma fixes its config dependency or a deliberate major migration. Tests do not replace live provider checks, backup restoration, monitoring or scale validation.
