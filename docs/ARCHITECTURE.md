# Architecture

Athenemy is a Next.js 16 App Router application with server-first routes and explicit integration boundaries.

## Layers

- `src/app`: public pages, dashboard pages, and API routes.
- `src/components`: brand, layout, forms, and reusable UI primitives.
- `src/lib`: env validation, auth helpers, permissions, service clients, schemas, mock data, and utilities.
- `prisma/schema.prisma`: LMS domain model for users, courses, lessons, resources, enrollments, progress, and payments.

## Integrations

- Clerk owns identity. `User.clerkId` links Clerk users to local Postgres profiles.
- Supabase Postgres is accessed through Prisma.
- Stripe Checkout creates paid enrollments after verified webhook events.
- Cloudflare R2 stores thumbnails, resources, and optional lesson files through signed upload URLs.
- Email is intentionally stubbed in `src/lib/email/index.ts`.

## Analytics

Instructor and admin dashboards read analytics through `src/lib/analytics.ts`. The query layer prefers persisted `AnalyticsRollup` rows for per-course and platform summaries, then derives the same metrics from enrollments, payments, lessons, and lesson progress when rollups have not been generated yet. Indexes on enrollment status, payment status/date, course ownership/status, and lesson completion support realistic dashboard query sizes.

## Local Fallbacks

When env vars are missing, public pages and dashboard previews use mock course data. API routes return actionable setup errors for missing Stripe, R2, Clerk, or database configuration.
