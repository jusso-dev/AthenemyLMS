# Cloudflare R2 Setup

1. Create an R2 bucket, for example `athenemy-dev`.
2. Create an R2 API token with object read/write permissions for that bucket.
3. Add values to `.env.local`:

```env
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_BASE_URL=
```

4. Configure a public bucket URL or custom domain for `CLOUDFLARE_R2_PUBLIC_BASE_URL`.
5. Add CORS rules that allow `PUT` from your app origin.

Example CORS:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
