import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  receipt: vi.fn(),
  enrollmentEmail: vi.fn(),
  payment: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  enrollment: { upsert: vi.fn(), updateMany: vi.fn() },
  transaction: vi.fn(),
  course: { findUniqueOrThrow: vi.fn() },
  user: { findUniqueOrThrow: vi.fn() },
  learningEvent: { upsert: vi.fn() },
}));
vi.mock("@/lib/stripe", () => ({
  assertStripeWebhookConfigured: vi.fn(),
  getStripe: () => ({ webhooks: { constructEvent: mocks.constructEvent } }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { payment: mocks.payment, $transaction: mocks.transaction },
}));
vi.mock("@/lib/email", () => ({
  sendCoursePurchaseReceipt: mocks.receipt,
  sendEnrollmentEmail: mocks.enrollmentEmail,
}));
import { POST } from "@/app/api/stripe/webhook/route";

const session = {
  id: "cs_test",
  mode: "payment",
  metadata: { userId: "user_1", courseId: "course_1" },
  amount_total: 1000,
  currency: "usd",
  payment_status: "paid",
  payment_intent: "pi_test",
};
const payment = {
  id: "payment_1",
  userId: "user_1",
  courseId: "course_1",
  amountCents: 1000,
  currency: "usd",
  status: "PENDING",
  receiptSentAt: null as Date | null,
  enrollmentEmailSentAt: null as Date | null,
  user: { email: "learner@example.test" },
  course: { title: "Test course" },
};
function request() {
  return new Request("https://example.test/api/stripe/webhook", {
    method: "POST",
    body: "signed event",
    headers: { "stripe-signature": "test" },
  });
}
function event(type = "checkout.session.completed", changes = {}) {
  mocks.constructEvent.mockReturnValue({
    id: "evt_test",
    type,
    created: 1,
    data: { object: { ...session, ...changes } },
  });
}
describe("Stripe purchase fulfilment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    event();
    mocks.transaction.mockImplementation((fn) =>
      fn({
        payment: mocks.payment,
        enrollment: mocks.enrollment,
        course: mocks.course,
        user: mocks.user,
        learningEvent: mocks.learningEvent,
      }),
    );
    mocks.course.findUniqueOrThrow.mockResolvedValue({
      organizationId: "org_1",
      title: "Course",
    });
    mocks.user.findUniqueOrThrow.mockResolvedValue({
      email: "learner@example.test",
      name: "Learner",
    });
    mocks.payment.findUnique.mockResolvedValue({ ...payment });
    mocks.payment.updateMany.mockResolvedValue({ count: 1 });
    mocks.payment.findUniqueOrThrow.mockResolvedValue({
      ...payment,
      status: "PAID",
    });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("does not fulfil an unpaid completed session", async () => {
    event("checkout.session.completed", { payment_status: "unpaid" });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.payment.updateMany).not.toHaveBeenCalled();
    expect(mocks.enrollment.upsert).not.toHaveBeenCalled();
    expect(mocks.receipt).not.toHaveBeenCalled();
  });
  it("fulfils asynchronous success without resetting completed enrolments", async () => {
    event("checkout.session.async_payment_succeeded");
    expect((await POST(request())).status).toBe(200);
    expect(mocks.enrollment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
    expect(mocks.enrollment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["CANCELLED", "REFUNDED"] },
        }),
      }),
    );
    expect(mocks.receipt).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "purchase-receipt/payment_1" }),
    );
  });
  it("does not resend checkpointed notifications or reopen a paid enrollment on redelivery", async () => {
    mocks.payment.findUnique.mockResolvedValue({ ...payment, status: "PAID" });
    mocks.payment.updateMany.mockResolvedValue({ count: 0 });
    mocks.payment.findUniqueOrThrow.mockResolvedValue({
      ...payment,
      status: "PAID",
      receiptSentAt: new Date(),
      enrollmentEmailSentAt: new Date(),
    });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.enrollment.upsert).not.toHaveBeenCalled();
    expect(mocks.receipt).not.toHaveBeenCalled();
    expect(mocks.enrollmentEmail).not.toHaveBeenCalled();
  });
  it("retries notification failures with stable delivery keys", async () => {
    mocks.receipt.mockRejectedValueOnce(new Error("Provider diagnostic"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(
      "Provider diagnostic",
    );
    expect(mocks.payment.update).not.toHaveBeenCalled();
    expect((await POST(request())).status).toBe(200);
    expect(
      mocks.receipt.mock.calls.map(([payload]) => payload.idempotencyKey),
    ).toEqual(["purchase-receipt/payment_1", "purchase-receipt/payment_1"]);
  });
  it("marks asynchronous failures without granting access", async () => {
    event("checkout.session.async_payment_failed", {
      payment_status: "unpaid",
    });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "payment_1", status: "PENDING" },
      data: { status: "FAILED" },
    });
    expect(mocks.enrollment.upsert).not.toHaveBeenCalled();
  });
  it("does not restore refunded purchases from old success events", async () => {
    mocks.payment.findUnique.mockResolvedValue({
      ...payment,
      status: "REFUNDED",
    });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.enrollment.upsert).not.toHaveBeenCalled();
    expect(mocks.receipt).not.toHaveBeenCalled();
  });
  it("requests retry when checkout persistence has not completed", async () => {
    mocks.payment.findUnique.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(500);
    expect(mocks.enrollment.upsert).not.toHaveBeenCalled();
  });
  it("rejects mismatched expected payment amount", async () => {
    event("checkout.session.completed", { amount_total: 1 });
    expect((await POST(request())).status).toBe(500);
    expect(mocks.enrollment.upsert).not.toHaveBeenCalled();
  });
  it("requests retry during database configuration outage", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect((await POST(request())).status).toBe(503);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("returns a safe client error for invalid signatures", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("Signature diagnostic");
    });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
