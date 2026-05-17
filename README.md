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
- Automation foundations: learning event log, automation rules, automation runs, notification delivery records, built-in recipe definitions, and Trigger.dev readiness state.
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
- Trigger.dev, optional: `TRIGGER_SECRET_KEY` or `TRIGGER_API_KEY`

See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## Tests

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

Playwright starts the local dev server automatically.

## Deployment Notes

Deploy to a Node-compatible Next.js host. Configure all production env vars in the hosting dashboard, run Prisma migrations against Supabase, configure Clerk URLs, forward Stripe webhooks to `/api/stripe/webhook`, and configure R2 CORS for browser uploads.

## Screenshots

Add screenshots after first deployment:

- Landing page
- Course catalogue
- Dashboard overview
- Course player
- Admin dashboard

## Documentation

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
