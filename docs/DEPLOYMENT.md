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
