# Deployment

## Prerequisites

- Production Supabase project
- Clerk application
- Stripe account with webhook endpoint
- Cloudflare R2 bucket and public URL
- Node-compatible Next.js hosting

## Steps

1. Set production env vars from `.env.example`.
2. Run Prisma migrations against Supabase.
3. Deploy the Next.js app.
4. Configure Clerk allowed origins and redirect URLs.
5. Configure Stripe webhook forwarding to `/api/stripe/webhook`.
6. Configure R2 CORS for signed browser uploads.

## Health Checks

- `/` renders marketing page.
- `/courses` renders catalogue.
- `/dashboard` requires Clerk when Clerk is configured.
- `/api/stripe/webhook` rejects unsigned requests.
- `/api/uploads/presign` returns setup or auth errors when not configured.

## Release gate

Read [Production readiness](PRODUCTION_READINESS.md) before release. Use Node 22.16+.
`npm start` now runs `npm run check:production` before starting Next.js; local
setup/demo mode remains available through `npm run dev`.

Configure `PLATFORM_ADMIN_CLERK_IDS` explicitly for global platform operators.
Organisation owners and admins use membership roles and do not need this grant.
Previously stored global ADMIN values alone no longer grant platform access.

Run `npm run db:deploy` for production migrations, including the payment email
checkpoint columns in migration 0012. Images require R2 in production; public
filesystem media is a local development fallback. Configure Stripe's endpoint
for the Checkout and reversal events listed in the readiness report and API version
`2026-08-26.dahlia`. Email must use Resend rather than the stub.

## Runtime services

Deploy the application together with a separately supervised `npm run worker`
process using the same database. Migrations 0013–0018 add persisted assessment
attempts, SCORM sessions, worker claims/delivery history, payment reversals, and
legacy backfills. The backfills preserve history, avoid replaying old events, and
mark legacy SCORM registrations without stored assets as requiring re-import.

Set `WEBHOOK_ENCRYPTION_KEY` to a base64-encoded 32-byte random value in your secret
manager; preserve it across deployments. Previously hashed-only webhook endpoints
must be recreated to obtain a usable signing secret. Set `SCORM_STORAGE_DIR` to an
absolute path on a persistent private volume shared by all application replicas,
outside `public/`. Include it in backups. Ephemeral/serverless filesystems do not
provide the required package durability. See [Automations](AUTOMATIONS.md),
[Developer platform](DEVELOPER_PLATFORM.md), and [Interoperability](INTEROPERABILITY.md).
