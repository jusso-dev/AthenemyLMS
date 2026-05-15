# Clerk Setup

1. Create a Clerk application.
2. Add these URLs:
   - Sign in: `/sign-in`
   - Sign up: `/sign-up`
   - After sign in: `/dashboard`
   - After sign up: `/dashboard`
3. Copy keys into `.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
```

4. Create a Clerk webhook for user events if you want async profile sync. The MVP also syncs the local user profile on authenticated app access.

## Roles

Athenemy stores roles in Postgres as `STUDENT`, `INSTRUCTOR`, and `ADMIN`. Role assignment can later be mirrored to Clerk metadata if desired.
