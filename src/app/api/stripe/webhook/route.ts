import { NextResponse } from "next/server";
import { env, IntegrationSetupError, missingEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { assertStripeWebhookConfigured, getStripe } from "@/lib/stripe";
import { sendCoursePurchaseReceipt } from "@/lib/email";

export async function POST(request: Request) {
  try {
    assertStripeWebhookConfigured();
    const stripe = getStripe();
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
    }

    const payload = await request.text();
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET!,
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const courseId = session.metadata?.courseId;
      const userId = session.metadata?.userId;

      if (courseId && userId && missingEnv(["DATABASE_URL"]).length === 0) {
        await prisma.$transaction([
          prisma.enrollment.upsert({
            where: { userId_courseId: { userId, courseId } },
            update: { status: "ACTIVE" },
            create: { userId, courseId, status: "ACTIVE" },
          }),
          prisma.payment.upsert({
            where: { stripeSessionId: session.id },
            update: {
              status: "PAID",
              stripePaymentId:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : session.payment_intent?.id,
              rawEvent: event as never,
            },
            create: {
              userId,
              courseId,
              stripeSessionId: session.id,
              stripePaymentId:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : session.payment_intent?.id,
              amountCents: session.amount_total ?? 0,
              currency: session.currency ?? "usd",
              status: "PAID",
              rawEvent: event as never,
            },
          }),
        ]);
      }

      if (session.customer_details?.email) {
        await sendCoursePurchaseReceipt({
          to: session.customer_details.email,
          courseTitle: courseId ?? "Athenemy course",
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof IntegrationSetupError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook failed" },
      { status: 400 },
    );
  }
}
