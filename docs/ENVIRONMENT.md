# Environment

Copy `.env.example` to `.env.local` and replace placeholders with real values.

```bash
cp .env.example .env.local
```

## Validation

`src/lib/env.ts` validates known env vars with Zod. Integration helpers call `assertIntegration` so missing service keys produce clear setup errors instead of unrelated crashes.

## Required Groups

### App

- `NEXT_PUBLIC_APP_URL`: local or deployed app URL.
- `NODE_ENV`: `development`, `test`, or `production`.

### Database

- `DATABASE_URL`: Supabase pooled connection string for Prisma Client.
- `DIRECT_URL`: Supabase direct connection string for migrations.

### Clerk

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- Clerk redirect URL env vars

### Stripe

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### Cloudflare R2

- `CLOUDFLARE_R2_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET_NAME`
- `CLOUDFLARE_R2_PUBLIC_BASE_URL`

### Email

- `EMAIL_PROVIDER`: use `stub` for local development or `resend` for transactional delivery.
- `EMAIL_FROM`: verified sender identity, for example `Athenemy <hello@yourdomain.com>`.
- `RESEND_API_KEY`: required when `EMAIL_PROVIDER=resend`.

## Secret Hygiene

`.env`, `.env.local`, and production env files are ignored by Git. Keep real values in local files or your deployment platform secret manager.
