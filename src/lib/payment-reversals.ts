import type Stripe from "stripe";
import { learningTransaction } from "@/lib/learning";
import { recordLearningEvent } from "@/lib/automations/events";

const terminalDisputes = new Set(["won", "lost", "warning_closed"]);
const suspendedDisputes = new Set(["needs_response", "under_review", "lost"]);

/** Signed provider events only. Transactions serialize refunds, disputes and access changes. */
export async function applyPaymentReversal(event: Stripe.Event) {
  const refund = event.type === "charge.refunded";
  const object = event.data.object as Stripe.Charge | Stripe.Dispute;
  const intent =
    typeof object.payment_intent === "string"
      ? object.payment_intent
      : object.payment_intent?.id;
  if (!intent) return;
  await learningTransaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { stripePaymentId: intent },
      include: { course: { select: { organizationId: true } } },
    });
    // Return a retryable error when Checkout's settlement write has not arrived yet.
    if (!payment) throw new Error("Payment mapping is not ready.");
    if (payment.currency.toLowerCase() !== object.currency.toLowerCase())
      throw new Error("Payment currency does not match.");
    let refundedAmountCents = payment.refundedAmountCents;
    let disputeStatus = payment.disputeStatus;
    let stripeDisputeId = payment.stripeDisputeId;
    let disputeEventCreated = payment.disputeEventCreated;
    if (refund) {
      const charge = object as Stripe.Charge;
      if (
        charge.amount !== payment.amountCents ||
        charge.amount_refunded > charge.amount
      )
        throw new Error("Refund amount does not match.");
      refundedAmountCents = Math.max(
        refundedAmountCents,
        charge.amount_refunded,
      );
    } else {
      const dispute = object as Stripe.Dispute;
      if (dispute.amount > payment.amountCents)
        throw new Error("Dispute amount does not match.");
      if (event.created < disputeEventCreated) return;
      if (
        stripeDisputeId === dispute.id &&
        terminalDisputes.has(disputeStatus ?? "") &&
        dispute.status !== disputeStatus
      )
        return;
      disputeStatus = dispute.status;
      stripeDisputeId = dispute.id;
      disputeEventCreated = event.created;
    }
    const fullRefund = refundedAmountCents >= payment.amountCents;
    const suspended = suspendedDisputes.has(disputeStatus ?? "");
    const status = fullRefund ? "REFUNDED" : suspended ? "DISPUTED" : "PAID";
    const enrollmentKey = {
      userId_courseId: { userId: payment.userId, courseId: payment.courseId },
    };
    const enrollment = await tx.enrollment.findUnique({ where: enrollmentKey });
    let suspendedEnrollmentStatus = payment.suspendedEnrollmentStatus;
    if (status !== "PAID") {
      const otherPurchase = await tx.payment.count({
        where: {
          id: { not: payment.id },
          userId: payment.userId,
          courseId: payment.courseId,
          status: "PAID",
        },
      });
      if (
        enrollment?.status === "ACTIVE" ||
        enrollment?.status === "COMPLETED"
      ) {
        // Preserve access history even if another purchase currently grants it;
        // that purchase may be refunded before this dispute is won.
        suspendedEnrollmentStatus = enrollment.status;
        if (!otherPurchase) {
          // Capture the latest completion state for every suspended purchase,
          // including learning completed while another purchase still granted access.
          await tx.payment.updateMany({
            where: {
              userId: payment.userId,
              courseId: payment.courseId,
              status: "DISPUTED",
            },
            data: { suspendedEnrollmentStatus: enrollment.status },
          });
          await tx.enrollment.update({
            where: enrollmentKey,
            data: { status: "REFUNDED" },
          });
        }
      }
    } else if (
      payment.status === "DISPUTED" &&
      enrollment?.status === "REFUNDED" &&
      (suspendedEnrollmentStatus === "ACTIVE" ||
        suspendedEnrollmentStatus === "COMPLETED")
    ) {
      // Manual removal uses CANCELLED and is never undone by a won dispute.
      await tx.enrollment.update({
        where: enrollmentKey,
        data: { status: suspendedEnrollmentStatus },
      });
      suspendedEnrollmentStatus = null;
    }
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status,
        refundedAmountCents,
        disputeStatus,
        stripeDisputeId,
        disputeEventCreated,
        suspendedEnrollmentStatus,
        rawEvent: { id: event.id, type: event.type, created: event.created },
      },
    });
    await recordLearningEvent(
      {
        organizationId: payment.course.organizationId,
        userId: payment.userId,
        courseId: payment.courseId,
        type: refund ? "payment.refunded" : "payment.disputed",
        idempotencyKey: `stripe:${event.id}`,
        payload: {
          paymentId: payment.id,
          status,
          refundedAmountCents,
          disputeStatus,
        },
      },
      tx,
    );
  });
}
