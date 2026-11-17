# Improvement audit and implementation

Source: [shadcn/improve](https://github.com/shadcn/improve), read 2026-11-17. Baseline: `2033a49`. All nine categories reviewed, with deeper analysis of tenant boundaries, learning, payments, uploads and verification. The user's request includes fixes, so confirmed findings were implemented rather than stopping at plans. No deployment, production database mutation, commit or PR was performed.

| Plan                                   | Priority | Scope                                                       | Status                                        |
| -------------------------------------- | -------- | ----------------------------------------------------------- | --------------------------------------------- |
| [001](001-tenant-boundaries.md)        | P0       | Organisation/platform roles and shared identities           | Implemented and locally verified              |
| [002](002-learning-integrity.md)       | P1       | Access, completion, assessments, certificates               | Implemented and locally verified              |
| [003](003-payments-and-media.md)       | P1       | Settled payments, validated durable uploads, API contracts  | Implemented and locally verified              |
| [005](005-integrated-lms-workflows.md) | P1       | Timers, SCORM, workers, reversals, pagination and local E2E | Implemented; verification in readiness report |
| [004](004-production-verification.md)  | P1       | Dependencies, UI accuracy, accessibility, CI                | Implemented and locally verified              |

Baseline lint, typecheck and 111 unit tests passed despite these defects. Final results are recorded in `docs/PRODUCTION_READINESS.md`.

## Vetted findings

Evidence describes baseline functions before fixes. All findings are HIGH confidence, confirmed against source. P0/P1 changes have MED implementation risk; UI/API changes LOW–MED. Each plan includes test requirements.

- P0: `organizations.ts:createOrganizationForUser` wrote global ADMIN; organisation member actions changed global roles and deleted shared accounts. Fixed through independent platform grants and membership-scoped changes.
- P1: `courses/actions.ts:submitAssessmentAction` lacked enrolment checks; cancelled enrolments still granted content access. Shared access rules now cover pages and learning writes.
- P1: no normal learning action wrote COMPLETED; `certificates.ts` required that status. Completion now reconciles lessons and required assessment passes transactionally.
- P1: omitted answers became option zero; count-before-insert attempt allocation raced. Validated answers and serializable retries address both, tested against real PostgreSQL.
- P1: Stripe completed sessions were fulfilled without settlement checks and retries repeated emails. Settlement checks, durable transitions, delivery checkpoints and provider idempotency now apply.
- P1: image uploads trusted declared MIME/size/extensions before public filesystem writes. Actual decoding, bounded bytes/pixels, canonical extensions and production R2 storage now apply.
- P1: dependency audit reported 26 advisories including one critical package. Framework and compatible dependencies updated; Prisma configuration uses a scoped patched merge dependency.
- P2: API pagination accepted invalid numbers and unexpected errors exposed internal messages. Explicit validation and generic server errors now apply.
- P2: analytics mislabeled lifetime revenue and fabricated progress; form cancellation happened after an await; skip navigation targeted a wrapper containing navigation. All corrected.
- P2: automation credentials implied working background execution and stub deliveries were marked SENT. States now reflect the actual implementation.
- P2: SCORM metadata chose the first resource, not the selected organisation's referenced launch item. Selection fixed; follow-up implements a bounded single-SCO SCORM 1.2 runtime.

## Considered and rejected

- Copying Moodle's dense interface conflicts with PRODUCT.md/DESIGN.md; adopt clear completion requirements and reliable workflows instead.
- SCORM 1.2 runtime is implemented with a documented single-SCO subset; xAPI/LTI and other enterprise foundations remain separate product scope.
- A forced Prisma major migration is unnecessary for the config-merge advisory; use a scoped patched override and verify generation/migrations.
- Blanket database administrator demotion would lose legitimate operator configuration. Runtime platform privilege now requires explicit PLATFORM_ADMIN_CLERK_IDS; legacy ADMIN rows alone confer no global authority.
- Unit tests cannot establish that live providers, backups or production operations are working.

## Grounded direction

1. Extend required assessments into optional module prerequisites only with a versioned curriculum/recompletion policy; avoid silently relocking historical learners.
2. Operate and monitor the implemented durable worker; credentials alone do not prove a worker is running.
3. Public catalogues and analytics now paginate and use database aggregates; continue workload-specific capacity testing and pagination of remaining administrative directories before institutional-scale deployment. No load-capacity claim is made.
