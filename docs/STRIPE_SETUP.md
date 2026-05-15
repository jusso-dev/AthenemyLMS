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
