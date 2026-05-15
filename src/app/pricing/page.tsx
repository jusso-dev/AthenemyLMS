import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const plans = [
  { name: "Self-host", price: "$0", text: "Run Athenemy with your own Supabase, Clerk, R2, and Stripe accounts." },
  { name: "Team foundation", price: "$79", text: "A suggested SaaS packaging point for small course teams." },
  { name: "Organisation", price: "Custom", text: "Multi-instructor operations, admin support, and platform ownership." },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          The open-source product is self-hostable. These tiers model how a
          hosted Athenemy SaaS could be packaged.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.name}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <p className="text-3xl font-semibold">{plan.price}</p>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm leading-6 text-muted-foreground">{plan.text}</p>
                <Button asChild variant={plan.name === "Self-host" ? "default" : "outline"}>
                  <Link href="/dashboard">Start setup</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
