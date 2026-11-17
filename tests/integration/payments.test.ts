import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { applyPaymentReversal } from "@/lib/payment-reversals";
const suffix = randomUUID();
let userId: string, courseId: string;
const payments: string[] = [];
beforeAll(async () => {
  if (
    !process.env.DATABASE_URL ||
    !new URL(process.env.DATABASE_URL).pathname.endsWith("_verify")
  )
    throw new Error("Disposable _verify database required");
  const user = await prisma.user.create({
    data: {
      clerkId: `payments-${suffix}`,
      email: `${suffix}@payment.example.test`,
    },
  });
  userId = user.id;
  const course = await prisma.course.create({
    data: {
      title: "Payment verification",
      slug: `payments-${suffix}`,
      instructorId: userId,
      status: "PUBLISHED",
    },
  });
  courseId = course.id;
});
afterAll(async () => {
  if (courseId) await prisma.learningEvent.deleteMany({ where: { courseId } });
  if (courseId) await prisma.course.delete({ where: { id: courseId } });
  if (userId) await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});
async function fixture() {
  await prisma.payment.deleteMany({ where: { id: { in: payments } } });
  const intent = `pi_${randomUUID()}`;
  const payment = await prisma.payment.create({
    data: {
      userId,
      courseId,
      amountCents: 1000,
      currency: "usd",
      status: "PAID",
      stripePaymentId: intent,
    },
  });
  payments.push(payment.id);
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, status: "COMPLETED" },
    update: { status: "COMPLETED" },
  });
  return { payment, intent };
}
function event(
  intent: string,
  type: string,
  values: Record<string, unknown>,
  created = 10,
) {
  return {
    id: `evt_${randomUUID()}`,
    type,
    created,
    data: {
      object: {
        id: "dp_fixture",
        payment_intent: intent,
        amount: 1000,
        currency: "usd",
        ...values,
      },
    },
  } as unknown as Stripe.Event;
}
async function enrollment() {
  return prisma.enrollment.findUniqueOrThrow({
    where: { userId_courseId: { userId, courseId } },
  });
}
describe("payment reversal state transitions on PostgreSQL", () => {
  it("retains partial-refund access and never regresses a full refund on stale replay", async () => {
    const { payment, intent } = await fixture();
    await applyPaymentReversal(
      event(intent, "charge.refunded", { amount_refunded: 300 }),
    );
    expect((await enrollment()).status).toBe("COMPLETED");
    await Promise.all(
      [1000, 1000].map((amount_refunded) =>
        applyPaymentReversal(
          event(intent, "charge.refunded", { amount_refunded }),
        ),
      ),
    );
    await applyPaymentReversal(
      event(intent, "charge.refunded", { amount_refunded: 300 }, 5),
    );
    expect((await enrollment()).status).toBe("REFUNDED");
    expect(
      await prisma.payment.findUnique({ where: { id: payment.id } }),
    ).toMatchObject({ status: "REFUNDED", refundedAmountCents: 1000 });
  });
  it("suspends disputes, restores won completion, and ignores terminal regressions", async () => {
    const { payment, intent } = await fixture();
    await applyPaymentReversal(
      event(intent, "charge.dispute.created", { status: "needs_response" }),
    );
    expect((await enrollment()).status).toBe("REFUNDED");
    await applyPaymentReversal(
      event(intent, "charge.dispute.closed", { status: "won" }, 20),
    );
    expect((await enrollment()).status).toBe("COMPLETED");
    await applyPaymentReversal(
      event(intent, "charge.dispute.updated", { status: "under_review" }, 30),
    );
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .status,
    ).toBe("PAID");
  });
  it("never restores manual cancellation after a won dispute", async () => {
    const { intent } = await fixture();
    await applyPaymentReversal(
      event(intent, "charge.dispute.created", { status: "needs_response" }),
    );
    await prisma.enrollment.update({
      where: { userId_courseId: { userId, courseId } },
      data: { status: "CANCELLED" },
    });
    await applyPaymentReversal(
      event(intent, "charge.dispute.closed", { status: "won" }, 20),
    );
    expect((await enrollment()).status).toBe("CANCELLED");
  });
  it("keeps access if another paid purchase grants it and rejects amount mismatches", async () => {
    const { intent } = await fixture();
    const other = await prisma.payment.create({
      data: { userId, courseId, amountCents: 1000, status: "PAID" },
    });
    payments.push(other.id);
    await applyPaymentReversal(
      event(intent, "charge.refunded", { amount_refunded: 1000 }),
    );
    expect((await enrollment()).status).toBe("COMPLETED");
    await expect(
      applyPaymentReversal(
        event(intent, "charge.refunded", { amount_refunded: 2000 }),
      ),
    ).rejects.toThrow("amount");
  });
  it("retries an unmapped payment instead of losing an early reversal", async () => {
    await expect(
      applyPaymentReversal(
        event("pi_unmapped", "charge.refunded", { amount_refunded: 1000 }),
      ),
    ).rejects.toThrow("mapping");
  });
});
