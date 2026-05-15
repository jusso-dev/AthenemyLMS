# Athenemy

Wisdom, structured into courses.

Athenemy is a modern self-hostable LMS for creators, teams, and small organisations. It provides a production-oriented MVP for selling, delivering, and tracking online courses with a clean Next.js app, role-aware dashboards, Supabase Postgres persistence, Clerk authentication, Cloudflare R2 uploads, and Stripe payments.

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

The app runs in local setup mode until real env values are added. Public pages and dashboard previews use mock course data. Protected production paths do not fake authentication.

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
- [Development](docs/DEVELOPMENT.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Roadmap](docs/ROADMAP.md)
- [Environment](docs/ENVIRONMENT.md)
- [Clerk Setup](docs/CLERK_SETUP.md)
- [Supabase Setup](docs/SUPABASE_SETUP.md)
- [Stripe Setup](docs/STRIPE_SETUP.md)
- [R2 Setup](docs/R2_SETUP.md)
- [Video Strategy](docs/VIDEO_STRATEGY.md)
