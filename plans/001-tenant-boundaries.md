# 001: Keep organisation privileges inside their organisation

Planned at `2033a49`, 2026-11-17. P0; effort M; risk MED; confidence HIGH. Depends on baseline verification.

Baseline: organizations.ts promoted creators to global ADMIN; settings/organization-actions.ts changed shared identities and deleted global accounts. Scope: permissions/auth/organisation helpers, settings/actions/schema, dependent authoring scopes and tests. Preserve other organisations and all historical learning records; no production account mutations.

Steps: preserve stored role on organisation creation; resolve global administration only from operator-controlled Clerk IDs; derive authoring from current membership. Member management changes organisation roles only. Remove membership and cancel only that organisation's enrolments in a serializable transaction; preserve the last owner. Restrict credential resets to platform administrators. Update dependent authoring/search/analytics scopes with AND/OR boundaries intact.

Done criteria: `npm run test -- tests/unit/permissions.test.ts tests/unit/organizations.test.ts tests/unit/organization-member-actions.test.ts`, typecheck and lint exit zero. Existing-role, cross-organisation, last-owner and shared-account invariants have coverage. Stop if a fix requires destructive data migration or changing production identities.

Maintenance: configure PLATFORM_ADMIN_CLERK_IDS explicitly. Stored ADMIN no longer grants global access. New authoring endpoints must use membership-aware helpers.
