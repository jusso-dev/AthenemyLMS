# Architecture

Athenemy is a Next.js 16 App Router application with server-first routes and explicit integration boundaries.

## Layers

- `src/app`: public pages, dashboard pages, and API routes.
- `src/components`: brand, layout, forms, and reusable UI primitives.
- `src/lib`: env validation, auth helpers, permissions, service clients, schemas, mock data, and utilities.
- `prisma/schema.prisma`: LMS domain model for users, courses, lessons, resources, enrollments, progress, and payments.

## Lesson Authoring

Lesson bodies are authored as Markdown through `src/components/forms/rich-lesson-editor.tsx` and persisted to `Lesson.content`. The renderer in `src/lib/lesson-markdown.tsx` maps supported Markdown blocks to React elements instead of injecting raw HTML, keeping previews and the lesson player safe by default.

## Integrations

- Clerk owns identity. `User.clerkId` links Clerk users to local Postgres profiles.
- Supabase Postgres is accessed through Prisma.
- Stripe Checkout creates paid enrollments after verified webhook events.
- Cloudflare R2 stores thumbnails, resources, and optional lesson files through signed upload URLs.
- Transactional email is routed through `src/lib/email/index.ts`, using safe stub delivery in local/test mode and Resend when configured.

## Analytics

Instructor and admin dashboards read analytics through `src/lib/analytics.ts`. The query layer prefers persisted `AnalyticsRollup` rows for per-course and platform summaries, then derives the same metrics from enrollments, payments, lessons, and lesson progress when rollups have not been generated yet. Indexes on enrollment status, payment status/date, course ownership/status, and lesson completion support realistic dashboard query sizes.

## Video

Lesson videos use a hybrid strategy documented in `docs/VIDEO_STRATEGY.md`: external embed URLs for fast setup and R2-hosted MP4/WebM uploads for self-hosted files. The lesson player renders YouTube, Vimeo, and direct video URLs while metadata remains persisted on the `Lesson` record.

## Assessments

Courses can include quiz assessments with persisted questions and submissions. Required assessments act as completion gates through `getCompletionGateStatus`, which checks whether a learner has passed every required assessment before course completion flows mark final completion.

## Local Fallbacks

When env vars are missing, public pages and dashboard previews use mock course data. API routes return actionable setup errors for missing Stripe, R2, Clerk, or database configuration.

## Certificates

Completed enrollments can issue one certificate per learner/course when `Course.certificatesEnabled` is true. Public certificate verification uses the certificate number and exposes only course, issuer, and issue date metadata, not private learner profile data.

Dashboard management pages read through `src/lib/dashboard-data.ts`. That layer uses Prisma when `DATABASE_URL` is configured and falls back to explicit mock data only for local setup or database connection failure states. Mutating dashboard operations live in `src/app/dashboard/courses/actions.ts`; they require a signed-in Clerk-backed user, validate form payloads with Zod, and check instructor/admin ownership before writing to Prisma.
