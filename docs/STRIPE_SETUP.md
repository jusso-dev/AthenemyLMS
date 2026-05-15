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

`checkout.session.completed` verifies the Stripe signature, creates or updates the payment record, and creates an active enrollment.

## Customer Billing Portal

1. In Stripe, open **Settings > Billing > Customer portal**.
2. Enable the portal and choose the customer actions Athenemy should allow, such as updating payment methods and viewing invoices.
3. Keep `NEXT_PUBLIC_APP_URL` set to the deployed app URL so portal sessions return users to `/dashboard/billing`.

Authenticated users open the portal through `POST /api/stripe/portal`. The route creates or reuses a Stripe customer, persists `User.stripeCustomerId`, and returns the Stripe-hosted portal URL. Supabase must be configured so customer IDs can be stored.
