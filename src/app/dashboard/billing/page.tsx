import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SetupMessage } from "@/lib/setup-message";
import { missingEnv } from "@/lib/env";

export default function BillingPage() {
  const stripeMissing = missingEnv(["STRIPE_SECRET_KEY"]).length > 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-2 text-muted-foreground">
          Course purchases use Stripe Checkout. A customer portal can be added
          after account and product settings are finalised.
        </p>
      </div>
      {stripeMissing ? (
        <SetupMessage
          title="Stripe setup required"
          items={[
            "Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.",
            "Use docs/STRIPE_SETUP.md to configure local webhook forwarding.",
          ]}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Billing portal placeholder</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline">
            <CreditCard className="h-4 w-4" />
            Open billing portal
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
