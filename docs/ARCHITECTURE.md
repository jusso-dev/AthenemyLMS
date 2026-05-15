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

## Local Fallbacks

When env vars are missing, public pages and dashboard previews use mock course data. API routes return actionable setup errors for missing Stripe, R2, Clerk, or database configuration.

## Organisations

Tenant data is stored in Prisma using organisations, memberships, and invitations with optional `clerkOrgId` linkage. Courses can belong to an organisation while existing single-owner courses keep `organizationId` null, preserving current creator workflows. Clerk organisation UI can be added later without changing the local tenant isolation model.
