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
