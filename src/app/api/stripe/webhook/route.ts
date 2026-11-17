import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env, IntegrationSetupError, missingEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { assertStripeWebhookConfigured, getStripe } from "@/lib/stripe";
import { sendCoursePurchaseReceipt, sendEnrollmentEmail } from "@/lib/email";

import { applyPaymentReversal } from "@/lib/payment-reversals";
import { recordLearningEvent } from "@/lib/automations/events";
import { recordCourseEvent } from "@/lib/learning-events";
import { learningTransaction } from "@/lib/learning";
export async function POST(request: Request) {
  try {
    assertStripeWebhookConfigured();
    const signature = request.headers.get("stripe-signature");
    if (!signature)
      return NextResponse.json(
        { error: "Missing Stripe signature" },
        { status: 400 },
      );
    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(
        await request.text(),
        signature,
        env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      return NextResponse.json(
        { error: "Invalid Stripe webhook signature" },
        { status: 400 },
      );
    }
    if (
      [
        "charge.refunded",
        "charge.dispute.created",
        "charge.dispute.updated",
        "charge.dispute.closed",
      ].includes(event.type)
    ) {
      await applyPaymentReversal(event);
      return NextResponse.json({ received: true });
    }
    if (
      event.type !== "checkout.session.completed" &&
      event.type !== "checkout.session.async_payment_succeeded" &&
      event.type !== "checkout.session.async_payment_failed" &&
      event.type !== "checkout.session.expired"
    ) {
      return NextResponse.json({ received: true });
    }
    if (missingEnv(["DATABASE_URL"]).length > 0) {
      return NextResponse.json(
        { error: "Payment processing is temporarily unavailable." },
        { status: 503 },
      );
    }
    const session = event.data.object;
    // Other Checkout integrations on the same Stripe account are not LMS purchases.
    if (
      !session.metadata?.courseId ||
      !session.metadata?.userId ||
      session.mode !== "payment"
    ) {
      return NextResponse.json({ received: true });
    }
    const failed =
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "checkout.session.expired";
    const settled =
      session.payment_status === "paid" ||
      session.payment_status === "no_payment_required";
    const paymentId = await learningTransaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { stripeSessionId: session.id },
      });
      // Checkout persists the expected amount and purchaser; retry if its write is still in flight.
      if (!payment) throw new Error("Payment record is not ready.");
      if (
        payment.userId !== session.metadata!.userId ||
        payment.courseId !== session.metadata!.courseId ||
        payment.amountCents !== session.amount_total ||
        payment.currency.toLowerCase() !== session.currency?.toLowerCase()
      ) {
        throw new Error("Payment details do not match.");
      }
      if (failed) {
        const changed = await tx.payment.updateMany({
          where: { id: payment.id, status: "PENDING" },
          data: { status: "FAILED" },
        });
        if (changed.count > 0)
          await recordCourseEvent(tx, {
            userId: payment.userId,
            courseId: payment.courseId,
            type: "payment.failed",
            idempotencyKey: `payment-failed:${payment.id}`,
            payload: { paymentId: payment.id },
          });
        return null;
      }
      if (!settled || ["REFUNDED", "DISPUTED"].includes(payment.status))
        return null;
      const changed = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } },
        data: {
          status: "PAID",
          stripePaymentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          rawEvent: { id: event.id, type: event.type, created: event.created },
        },
      });
      if (changed.count > 0) {
        await tx.enrollment.upsert({
          where: {
            userId_courseId: {
              userId: payment.userId,
              courseId: payment.courseId,
            },
          },
          update: {},
          create: {
            userId: payment.userId,
            courseId: payment.courseId,
            status: "ACTIVE",
          },
        });
        await tx.enrollment.updateMany({
          where: {
            userId: payment.userId,
            courseId: payment.courseId,
            status: { in: ["CANCELLED", "REFUNDED"] },
          },
          data: { status: "ACTIVE" },
        });
      }
      if (changed.count > 0) {
        const details = await tx.course.findUniqueOrThrow({
          where: { id: payment.courseId },
          select: { organizationId: true, title: true },
        });
        const learner = await tx.user.findUniqueOrThrow({
          where: { id: payment.userId },
          select: { email: true, name: true },
        });
        for (const type of ["payment.succeeded", "user.enrolled"])
          await recordLearningEvent(
            {
              organizationId: details.organizationId,
              userId: payment.userId,
              courseId: payment.courseId,
              type,
              idempotencyKey: `${type}:${payment.id}`,
              payload: {
                paymentId: payment.id,
                email: learner.email,
                userName: learner.name,
                courseTitle: details.title,
              },
            },
            tx,
          );
      }
      return payment.id;
    });
    if (paymentId) {
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: {
          user: { select: { email: true } },
          course: { select: { title: true } },
        },
      });
      if (payment.status === "PAID") {
        const payload = {
          to: payment.user.email,
          courseTitle: payment.course.title,
        };
        // Checkpoints survive webhook retries; provider keys deduplicate overlapping deliveries.
        if (!payment.receiptSentAt) {
          await sendCoursePurchaseReceipt({
            ...payload,
            idempotencyKey: `purchase-receipt/${payment.id}`,
          });
          await prisma.payment.update({
            where: { id: payment.id },
            data: { receiptSentAt: new Date() },
          });
        }
        if (!payment.enrollmentEmailSentAt) {
          await sendEnrollmentEmail({
            ...payload,
            idempotencyKey: `purchase-enrollment/${payment.id}`,
          });
          await prisma.payment.update({
            where: { id: payment.id },
            data: { enrollmentEmailSentAt: new Date() },
          });
        }
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof IntegrationSetupError)
      return NextResponse.json(
        { error: "Payment processing is not configured." },
        { status: 503 },
      );
    return NextResponse.json(
      { error: "Payment processing failed. Please retry." },
      { status: 500 },
    );
  }
}
