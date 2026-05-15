# Email Setup

Athenemy supports safe local stubs and Resend transactional email.

## Local Development

Keep the default stub provider:

```env
EMAIL_PROVIDER=stub
EMAIL_FROM="Athenemy <hello@example.com>"
```

Stubbed sends log in development and stay quiet in tests.

## Resend

1. Create a Resend account.
2. Verify the sending domain or sender address.
3. Add production env vars:

```env
EMAIL_PROVIDER=resend
EMAIL_FROM="Athenemy <hello@yourdomain.com>"
RESEND_API_KEY="re_..."
```

Welcome, enrollment, purchase receipt, and course published emails are sent through the same provider abstraction. Missing Resend config raises actionable errors instead of silently dropping production mail.
