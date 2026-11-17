# Athenemy

<p>
  <img src="./public/athena-lms-logo.png" alt="Athenemy logo" width="360" />
</p>

Wisdom, structured into courses.

Athenemy is a modern self-hostable LMS for creators, teams, and small organisations. It provides a production-oriented MVP for selling, delivering, and tracking online courses with a clean Next.js app, role-aware dashboards, Supabase Postgres persistence, Clerk authentication, Cloudflare R2 uploads, Stripe payments, a starter course library, and integration foundations.

## Current Capabilities

- Course authoring with sections, lessons, Markdown content, resources, video URLs, R2-hosted video uploads, assessments, completion gates, certificates, import/export, and lifecycle controls.
- Organization workspaces with memberships, invitations, roles, onboarding, branded portals, media assets, and public course catalogues.
- Default course library for editable starter training such as cybersecurity awareness, phishing awareness, password/MFA hygiene, acceptable use, incident response, and data privacy.
- Developer platform foundations: organization-scoped API keys, scoped `/api/v1` endpoints, consistent JSON errors, pagination, and webhook endpoint management.
- Durable automation: transactional learning events, leased PostgreSQL jobs, retries, email recipes, inactivity reminders, signed webhook delivery and scoped replay.
- Persisted timed assessments, scheduled feedback, and a private sandboxed single-SCO SCORM 1.2 runtime with progress/resume and completion gates.
- Payment refunds/disputes and paginated catalogues/analytics with net revenue separated by currency.
- Enterprise, commerce, and social learning foundations: audit logs, privacy settings, custom role capability presets, bundles, coupons, cohorts, discussions, and live sessions.

## Tech Stack

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4 and shadcn/ui-style primitives
- Prisma and Supabase Postgres
- Clerk authentication
- Stripe Checkout and webhooks
- Cloudflare R2 via S3-compatible signed uploads
- Zod, React Hook Form
- Vitest and Playwright
- ESLint, Prettier, GitHub issue and PR templates

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run db:generate
npm run dev
```

The app runs in setup mode until real env values are added. Public pages and dashboard surfaces show empty persisted-data states until Supabase is configured. Protected production paths do not fake authentication.

## Database Setup

1. Create a Supabase project.
2. Add the pooled connection string to `DATABASE_URL`.
3. Add the direct connection string to `DIRECT_URL`.
4. Run:

```bash
npm run db:generate
npm run db:migrate
```

## Required Env Vars

Use `.env.example` as the source of truth. The main required groups are:

- App URL: `NEXT_PUBLIC_APP_URL`
- Supabase: `DATABASE_URL`, `DIRECT_URL`
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Cloudflare R2: account, access key, secret, bucket, public base URL
- Worker signing-secret encryption: `WEBHOOK_ENCRYPTION_KEY`; run `npm run worker` alongside the app.
- Private persistent SCORM volume: `SCORM_STORAGE_DIR`

See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## Tests

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
# With a migrated disposable local PostgreSQL database ending in _verify:
npm run test:integration
npm run test:workflows
```

Playwright starts the local dev server automatically.

## Deployment Notes

Read the [production readiness review](docs/PRODUCTION_READINESS.md) for the
implemented safeguards, verification results, remaining limitations and release
checks. Node 22.16+ is required. `npm start` runs production configuration checks;
use `npm run dev` for unconfigured local setup mode. Global administrators must be
explicitly listed in `PLATFORM_ADMIN_CLERK_IDS`.

Deploy to a Node-compatible Next.js host. Configure all production env vars in the hosting dashboard, run Prisma migrations against Supabase, configure Clerk URLs, forward Stripe webhooks to `/api/stripe/webhook`, and configure R2 CORS for browser uploads.

## Screenshots

Add screenshots after first deployment:

- Landing page
- Course catalogue
- Dashboard overview
- Course player
- Admin dashboard

## Documentation

- [Production readiness and verification](docs/PRODUCTION_READINESS.md)
- [Assessments and analytics](docs/ASSESSMENTS_AND_ANALYTICS.md)
- [SCORM interoperability](docs/INTEROPERABILITY.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Accessibility Audit](docs/ACCESSIBILITY_AUDIT.md)
- [Automations](docs/AUTOMATIONS.md)
- [Course Import and Export](docs/COURSE_IMPORT_EXPORT.md)
- [Default Course Library](docs/DEFAULT_COURSE_LIBRARY.md)
- [Developer Platform](docs/DEVELOPER_PLATFORM.md)
- [Development](docs/DEVELOPMENT.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Enterprise, Commerce, and Social Learning](docs/ENTERPRISE_COMMERCE_SOCIAL.md)
- [Roadmap](docs/ROADMAP.md)
- [Environment](docs/ENVIRONMENT.md)
- [Email Setup](docs/EMAIL_SETUP.md)
- [Clerk Setup](docs/CLERK_SETUP.md)
- [Supabase Setup](docs/SUPABASE_SETUP.md)
- [Stripe Setup](docs/STRIPE_SETUP.md)
- [R2 Setup](docs/R2_SETUP.md)
- [Video Strategy](docs/VIDEO_STRATEGY.md)
