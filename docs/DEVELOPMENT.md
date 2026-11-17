# Development

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run db:generate
npm run db:migrate
```

## Workflow

1. Create or update a GitHub issue.
2. Branch from `main`.
3. Keep changes scoped to the issue.
4. Add or update tests for behaviour changes.
5. Open a PR using `.github/pull_request_template.md`.

## UI

The design uses an Athenian ink and gold palette through CSS variables in `src/app/globals.css`. Reusable components live in `src/components/ui` and follow shadcn/ui conventions without requiring generated component metadata.

## Data

Use Prisma for structured data. Avoid ad hoc SQL unless there is a clear performance or migration reason.

## Database integration verification

`npm run test:integration` uses real PostgreSQL for concurrent attempt limits,
lesson completion, certificate uniqueness and cancelled enrolments. Configure
`DATABASE_URL` and `DIRECT_URL` for a disposable database whose name ends in
`_verify`, apply `npm run db:deploy`, then run the suite. It creates unique
fixtures and removes only those fixtures; it never resets the database.

`npm run check:production` validates production configuration without printing
credential values. It is expected to fail for a local setup-only environment.

## Local authenticated browser workflows

`npm run test:workflows` exercises authoring/publishing, free enrolment, lesson
completion, timed assessment start/resume/expiry, certificate issuance/PDF, revoked
access, and SCORM import/launch/save/resume/completion against real PostgreSQL.
Use a loopback `DATABASE_URL` and `DIRECT_URL` ending in `_verify`, with migrations
applied. Install Chromium with `npx playwright install chromium` first.

The harness copies the app to a temporary directory, substitutes a test identity
adapter **only in that copy**, and binds it to `127.0.0.1:3101`. Cookie identities
must match that run's persisted fixtures. Production authentication is unchanged.
The copy receives an allowlist of environment variables, no provider credentials
or checkout `.env` files, stub email, and temporary private SCORM storage. It and
its server are removed on exit; tests delete their own database fixtures.

Integration tests additionally exercise locally signed Stripe events, refunds,
disputes, durable worker claims/retries, webhook signatures and tenant boundaries.
External delivery is mocked; database transactions, package extraction, isolated
browser execution, and PDFs are real. No live account or staging URL is required.
