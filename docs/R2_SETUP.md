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

Production organisation images are decoded and validated on the server, then
written to R2. Missing R2 configuration returns a setup error; filesystem uploads
are only a development fallback. The bucket token also needs object deletion
permission for cleanup if database persistence fails.

`POST /api/uploads/presign` requires `fileName`, `contentType`, `fileSize` (bytes)
and `folder`. Upload the same file bytes and Content-Type used to sign the
request. Allowed sizes are 5 MB for images, 25 MB for resources and 500 MB for
videos. Use your deployed HTTPS origin instead of localhost in production CORS.

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
