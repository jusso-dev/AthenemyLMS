import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { env, IntegrationSetupError, missingEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/stripe-customers";

export async function POST() {
  try {
    const missingStripe = missingEnv(["STRIPE_SECRET_KEY"]);
    if (missingStripe.length > 0) {
      return NextResponse.json(
        {
          error:
            "Stripe is not configured. Add STRIPE_SECRET_KEY and enable the customer portal in Stripe.",
        },
        { status: 503 },
      );
    }

    if (missingEnv(["DATABASE_URL"]).length > 0) {
      return NextResponse.json(
        {
          error:
            "Supabase is not configured. Add DATABASE_URL so Stripe customer IDs can be persisted.",
        },
        { status: 503 },
      );
    }

    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const stripe = getStripe();
    const customer = await getOrCreateStripeCustomer(stripe, user);
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof IntegrationSetupError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Billing portal failed" },
      { status: 500 },
    );
  }
}
