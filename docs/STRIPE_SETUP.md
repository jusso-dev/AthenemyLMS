# Stripe Setup

1. Create or open a Stripe account.
2. Copy test keys into `.env.local`:

```env
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

3. Forward local webhooks:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

4. Copy the webhook signing secret into:

```env
STRIPE_WEBHOOK_SECRET=
```

## Webhook Behaviour

Use webhook API version `2026-08-26.dahlia` and subscribe to
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`,
`charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, and
`charge.dispute.closed`.

Checkout persists the expected purchase before redirecting. The webhook verifies
the signature and purchase details, then grants access only after confirmed
payment. Pending delayed payments grant no access; later success fulfils them,
while failure/expiry updates pending payment state. Repeated events preserve
completed enrolments and use per-email checkpoints plus provider idempotency keys.
Temporary processing failures remain retryable, including a reversal that arrives
before Checkout has persisted its PaymentIntent mapping.

Partial refunds retain access and reduce net revenue. A full refund revokes access.
Open/lost disputes suspend access; a won dispute restores the previous active or
completed state only when a purchase reversal suspended it. Manual cancellation is
never undone by dispute resolution. Another valid paid purchase preserves access.
Refund amounts never regress on older events, terminal disputes ignore stale
updates, and old checkout success cannot reopen a refunded/disputed purchase.
Transitions and outbox events commit together. Historical certificates remain
records of past achievement. Operators initiate refunds and handle disputes in
Stripe; no refund-creation UI or subscription/bundle/coupon fulfilment is implied.

Local integration tests generate real Stripe signatures and use the handler with
PostgreSQL and mocked delivery; they never contact Stripe or move money.

## Customer Billing Portal

1. In Stripe, open **Settings > Billing > Customer portal**.
2. Enable the portal and choose the customer actions Athenemy should allow, such as updating payment methods and viewing invoices.
3. Keep `NEXT_PUBLIC_APP_URL` set to the deployed app URL so portal sessions return users to `/dashboard/billing`.

Authenticated users open the portal through `POST /api/stripe/portal`. The route creates or reuses a Stripe customer, persists `User.stripeCustomerId`, and returns the Stripe-hosted portal URL. Supabase must be configured so customer IDs can be stored.
