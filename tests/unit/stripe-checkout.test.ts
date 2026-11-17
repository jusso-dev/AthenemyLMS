import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  course: vi.fn(),
  enrollment: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  payment: vi.fn(),
  customer: vi.fn(),
  session: vi.fn(),
  email: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentAppUser: mocks.user }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    course: { findUnique: mocks.course },
    enrollment: mocks.enrollment,
    payment: { upsert: mocks.payment },
  },
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { create: mocks.session } } }),
}));
vi.mock("@/lib/stripe-customers", () => ({
  getOrCreateStripeCustomer: mocks.customer,
}));
vi.mock("@/lib/email", () => ({ sendEnrollmentEmail: mocks.email }));
import { POST } from "@/app/api/stripe/checkout/route";
const request = (body: unknown) =>
  new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify(body),
  });
describe("checkout purchase boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    mocks.user.mockResolvedValue({
      id: "user_1",
      email: "learner@example.test",
    });
    mocks.course.mockResolvedValue({
      id: "course_1",
      status: "PUBLISHED",
      title: "Course",
      priceCents: 1000,
      currency: "usd",
      slug: "course",
    });
    mocks.enrollment.findUnique.mockResolvedValue(null);
    mocks.customer.mockResolvedValue("cus_1");
    mocks.session.mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.example.test",
    });
  });
  afterEach(() => vi.unstubAllEnvs());
  it.each(["ACTIVE", "COMPLETED"])(
    "does not charge a learner with %s access",
    async (status) => {
      mocks.enrollment.findUnique.mockResolvedValue({ status });
      const response = await POST(request({ courseId: "course_1" }));
      expect(response.status).toBe(200);
      expect((await response.json()).url).toContain(
        "/dashboard/learn/course_1",
      );
      expect(mocks.session).not.toHaveBeenCalled();
      expect(mocks.enrollment.upsert).not.toHaveBeenCalled();
    },
  );
  it("validates the request before querying a course", async () => {
    expect((await POST(request({ courseId: 42 }))).status).toBe(400);
    expect(mocks.course).not.toHaveBeenCalled();
  });
  it("stores the expected payment without overwriting existing fulfilment", async () => {
    expect((await POST(request({ courseId: "course_1" }))).status).toBe(200);
    expect(mocks.payment).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSessionId: "cs_1" },
        update: {},
        create: expect.objectContaining({
          amountCents: 1000,
          userId: "user_1",
          courseId: "course_1",
          status: "PENDING",
        }),
      }),
    );
  });
  it("does not return internal payment errors", async () => {
    mocks.session.mockRejectedValue(new Error("Private gateway detail"));
    const response = await POST(request({ courseId: "course_1" }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(
      "Private gateway detail",
    );
  });
});
