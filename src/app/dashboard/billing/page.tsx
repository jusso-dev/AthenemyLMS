import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SetupMessage } from "@/lib/setup-message";
import { missingEnv } from "@/lib/env";
import { BillingPortalButton } from "@/components/billing/billing-portal-button";

export default function BillingPage() {
  const stripeMissing = missingEnv(["STRIPE_SECRET_KEY"]).length > 0;
  const databaseMissing = missingEnv(["DATABASE_URL"]).length > 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-2 text-muted-foreground">
          Course purchases use Stripe Checkout. Manage payment methods,
          receipts, and billing details through the Stripe customer portal.
        </p>
      </div>
      {stripeMissing || databaseMissing ? (
        <SetupMessage
          title="Billing setup required"
          items={[
            "Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, and DATABASE_URL.",
            "Enable the Stripe customer portal and use docs/STRIPE_SETUP.md to configure local webhook forwarding.",
          ]}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Customer portal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Stripe hosts invoices, saved payment methods, and customer billing
            details for authenticated learners.
          </p>
          <BillingPortalButton disabled={stripeMissing || databaseMissing} />
        </CardContent>
      </Card>
    </div>
  );
}
