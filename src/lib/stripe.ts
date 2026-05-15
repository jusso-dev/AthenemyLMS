import Stripe from "stripe";
import { assertIntegration, env } from "@/lib/env";

export function getStripe() {
  assertIntegration("stripe", ["STRIPE_SECRET_KEY"]);
  return new Stripe(env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-04-22.dahlia",
  });
}

export function assertStripeWebhookConfigured() {
  assertIntegration("stripe", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]);
}
