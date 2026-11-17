import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
const fixture = vi.hoisted(() => ({
  secret: "whsec_local_verification_fixture",
  receipt: vi.fn(),
  enrollmentEmail: vi.fn(),
}));
vi.mock("@/lib/env", async (original) => {
  const actual = await original<typeof import("@/lib/env")>();
  return {
    ...actual,
    env: { ...actual.env, STRIPE_WEBHOOK_SECRET: fixture.secret },
  };
});
vi.mock("@/lib/stripe", async (original) => {
  const actual = await original<typeof import("@/lib/stripe")>();
  const { default: StripeSDK } = await import("stripe");
  return {
    ...actual,
    getStripe: () => new StripeSDK("sk_test_local_verification_fixture"),
  };
});
vi.mock("@/lib/email", () => ({
  sendCoursePurchaseReceipt: fixture.receipt,
  sendEnrollmentEmail: fixture.enrollmentEmail,
}));
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/stripe/webhook/route";
const sdk = new Stripe("sk_test_local_verification_fixture");
const courseIds: string[] = [],
  userIds: string[] = [];
let userId: string;
let databaseVerified = false;
beforeAll(async () => {
  if (
    !process.env.DATABASE_URL ||
    !new URL(process.env.DATABASE_URL).pathname.endsWith("_verify")
  )
    throw new Error(
      "Signed webhook tests require a disposable _verify database.",
    );
  databaseVerified = true;
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_local_verification_fixture");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", fixture.secret);
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      clerkId: `signed-stripe-${suffix}`,
      email: `${suffix}@signed-stripe.example.test`,
    },
  });
  userId = user.id;
  userIds.push(user.id);
});
beforeEach(() => {
  fixture.receipt.mockReset().mockResolvedValue(undefined);
  fixture.enrollmentEmail.mockReset().mockResolvedValue(undefined);
});
afterAll(async () => {
  if (databaseVerified) {
    await prisma.learningEvent.deleteMany({
      where: { courseId: { in: courseIds } },
    });
    await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
  vi.unstubAllEnvs();
});
async function pendingPurchase() {
  const suffix = randomUUID();
  const course = await prisma.course.create({
    data: {
      title: "Signed Stripe verification",
      slug: `signed-stripe-${suffix}`,
      instructorId: userId,
      status: "PUBLISHED",
      priceCents: 1200,
    },
  });
  courseIds.push(course.id);
  const sessionId = `cs_test_${suffix}`,
    intentId = `pi_${suffix}`;
  const payment = await prisma.payment.create({
    data: {
      userId,
      courseId: course.id,
      stripeSessionId: sessionId,
      amountCents: 1200,
      currency: "usd",
      status: "PENDING",
    },
  });
  const session = {
    id: sessionId,
    object: "checkout.session",
    mode: "payment",
    metadata: { userId, courseId: course.id },
    amount_total: 1200,
    currency: "usd",
    payment_status: "paid",
    payment_intent: intentId,
  };
  return { course, payment, session, intentId };
}
function event(
  type: string,
  object: Record<string, unknown>,
  created = Math.floor(Date.now() / 1000),
) {
  return {
    id: `evt_${randomUUID()}`,
    object: "event",
    type,
    created,
    livemode: false,
    pending_webhooks: 1,
    api_version: "2026-08-26.dahlia",
    request: null,
    data: { object },
  };
}
async function deliver(
  value: ReturnType<typeof event>,
  secret = fixture.secret,
) {
  const payload = JSON.stringify(value);
  const signature = sdk.webhooks.generateTestHeaderString({ payload, secret });
  return POST(
    new Request("https://local.example.test/api/stripe/webhook", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": signature },
    }),
  );
}
async function enrollment(courseId: string) {
  return prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
}
describe("locally signed Stripe webhook route with PostgreSQL", () => {
  it("records delayed payment failure once without granting access", async () => {
    const { course, payment, session } = await pendingPurchase();
    const failure = event("checkout.session.async_payment_failed", {
      ...session,
      payment_status: "unpaid",
    });
    expect((await deliver(failure)).status).toBe(200);
    expect((await deliver(failure)).status).toBe(200);
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .status,
    ).toBe("FAILED");
    expect(await enrollment(course.id)).toBeNull();
    expect(
      await prisma.learningEvent.count({
        where: { courseId: course.id, type: "payment.failed" },
      }),
    ).toBe(1);
  });
  it("rejects a real invalid signature without changing payment or access", async () => {
    const { course, payment, session } = await pendingPurchase();
    const response = await deliver(
      event("checkout.session.completed", session),
      "whsec_wrong_local_fixture",
    );
    expect(response.status).toBe(400);
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .status,
    ).toBe("PENDING");
    expect(await enrollment(course.id)).toBeNull();
    expect(fixture.receipt).not.toHaveBeenCalled();
  });
  it("ignores unpaid completion, then settles concurrent delayed success with one enrollment and event pair", async () => {
    const { course, payment, session } = await pendingPurchase();
    expect(
      (
        await deliver(
          event("checkout.session.completed", {
            ...session,
            payment_status: "unpaid",
          }),
        )
      ).status,
    ).toBe(200);
    expect(await enrollment(course.id)).toBeNull();
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .status,
    ).toBe("PENDING");
    const success = event("checkout.session.async_payment_succeeded", session);
    const responses = await Promise.all([deliver(success), deliver(success)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(
      await prisma.enrollment.count({ where: { userId, courseId: course.id } }),
    ).toBe(1);
    expect((await enrollment(course.id))?.status).toBe("ACTIVE");
    expect(
      await prisma.learningEvent.count({
        where: { courseId: course.id, type: "payment.succeeded" },
      }),
    ).toBe(1);
    expect(
      await prisma.learningEvent.count({
        where: { courseId: course.id, type: "user.enrolled" },
      }),
    ).toBe(1);
    const stored = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(stored.status).toBe("PAID");
    expect(stored.receiptSentAt).not.toBeNull();
    expect(stored.enrollmentEmailSentAt).not.toBeNull();
    expect(
      new Set(
        fixture.receipt.mock.calls.map(([input]) => input.idempotencyKey),
      ),
    ).toEqual(new Set([`purchase-receipt/${payment.id}`]));
    const sent = [
      fixture.receipt.mock.calls.length,
      fixture.enrollmentEmail.mock.calls.length,
    ];
    expect((await deliver(success)).status).toBe(200);
    expect([
      fixture.receipt.mock.calls.length,
      fixture.enrollmentEmail.mock.calls.length,
    ]).toEqual(sent);
  });
  it("resumes after a notification failure using persisted delivery checkpoints", async () => {
    const { payment, session } = await pendingPurchase();
    fixture.enrollmentEmail.mockRejectedValueOnce(
      new Error("Local simulated notification failure"),
    );
    const success = event("checkout.session.completed", session);
    const failed = await deliver(success);
    expect(failed.status).toBe(500);
    expect(await failed.text()).not.toContain("Local simulated");
    const stored = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(stored.status).toBe("PAID");
    expect(stored.receiptSentAt).not.toBeNull();
    expect(stored.enrollmentEmailSentAt).toBeNull();
    expect((await deliver(success)).status).toBe(200);
    expect(fixture.receipt).toHaveBeenCalledTimes(1);
    expect(fixture.enrollmentEmail).toHaveBeenCalledTimes(2);
    expect(
      new Set(
        fixture.enrollmentEmail.mock.calls.map(
          ([input]) => input.idempotencyKey,
        ),
      ),
    ).toEqual(new Set([`purchase-enrollment/${payment.id}`]));
  });
  it("preserves revoked access after signed full refund and stale checkout success", async () => {
    const { course, payment, session, intentId } = await pendingPurchase();
    const success = event("checkout.session.completed", session);
    expect((await deliver(success)).status).toBe(200);
    const refund = event("charge.refunded", {
      id: `ch_${randomUUID()}`,
      object: "charge",
      payment_intent: intentId,
      currency: "usd",
      amount: 1200,
      amount_refunded: 1200,
    });
    expect((await deliver(refund)).status).toBe(200);
    expect((await deliver(refund)).status).toBe(200);
    expect((await enrollment(course.id))?.status).toBe("REFUNDED");
    expect((await deliver(success)).status).toBe(200);
    expect((await enrollment(course.id))?.status).toBe("REFUNDED");
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .status,
    ).toBe("REFUNDED");
    expect(
      await prisma.learningEvent.count({
        where: { courseId: course.id, type: "payment.refunded" },
      }),
    ).toBe(1);
  });
  it("suspends on a signed dispute, preserves completion on win and ignores a stale status", async () => {
    const { course, session, intentId } = await pendingPurchase();
    expect(
      (await deliver(event("checkout.session.completed", session))).status,
    ).toBe(200);
    await prisma.enrollment.update({
      where: { userId_courseId: { userId, courseId: course.id } },
      data: { status: "COMPLETED" },
    });
    const dispute = {
      id: `dp_${randomUUID()}`,
      object: "dispute",
      payment_intent: intentId,
      currency: "usd",
      amount: 1200,
      status: "needs_response",
    };
    expect(
      (await deliver(event("charge.dispute.created", dispute, 100))).status,
    ).toBe(200);
    expect((await enrollment(course.id))?.status).toBe("REFUNDED");
    expect(
      (
        await deliver(
          event("charge.dispute.closed", { ...dispute, status: "won" }, 200),
        )
      ).status,
    ).toBe(200);
    expect((await enrollment(course.id))?.status).toBe("COMPLETED");
    expect(
      (
        await deliver(
          event(
            "charge.dispute.updated",
            { ...dispute, status: "under_review" },
            150,
          ),
        )
      ).status,
    ).toBe(200);
    expect((await enrollment(course.id))?.status).toBe("COMPLETED");
  });
  it("restores a won purchase when a second purchase was refunded during its dispute", async () => {
    const { course, session, intentId } = await pendingPurchase();
    expect(
      (await deliver(event("checkout.session.completed", session))).status,
    ).toBe(200);
    const otherIntent = `pi_${randomUUID()}`;
    await prisma.payment.create({
      data: {
        userId,
        courseId: course.id,
        amountCents: 1200,
        status: "PAID",
        stripePaymentId: otherIntent,
      },
    });
    const dispute = {
      id: `dp_${randomUUID()}`,
      object: "dispute",
      payment_intent: intentId,
      currency: "usd",
      amount: 1200,
      status: "needs_response",
    };
    expect(
      (await deliver(event("charge.dispute.created", dispute, 100))).status,
    ).toBe(200);
    expect((await enrollment(course.id))?.status).toBe("ACTIVE");
    // Learning remains possible through the other paid purchase.
    await prisma.enrollment.update({
      where: { userId_courseId: { userId, courseId: course.id } },
      data: { status: "COMPLETED" },
    });
    expect(
      (
        await deliver(
          event("charge.refunded", {
            id: `ch_${randomUUID()}`,
            object: "charge",
            payment_intent: otherIntent,
            currency: "usd",
            amount: 1200,
            amount_refunded: 1200,
          }),
        )
      ).status,
    ).toBe(200);
    expect((await enrollment(course.id))?.status).toBe("REFUNDED");
    expect(
      (
        await deliver(
          event("charge.dispute.closed", { ...dispute, status: "won" }, 200),
        )
      ).status,
    ).toBe(200);
    expect((await enrollment(course.id))?.status).toBe("COMPLETED");
  });
});
