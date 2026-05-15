import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const stripe = {
    customers: {
      create: vi.fn(),
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
  };

  return {
    stripe,
    getStripe: vi.fn(() => stripe),
    getCurrentAppUser: vi.fn(),
    prisma: {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/stripe", () => ({ getStripe: mocks.getStripe }));
vi.mock("@/lib/auth", () => ({ getCurrentAppUser: mocks.getCurrentAppUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { POST } from "@/app/api/stripe/portal/route";

describe("Stripe billing portal route", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_portal";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/athenemy";
    vi.clearAllMocks();
    mocks.getCurrentAppUser.mockResolvedValue({
      id: "user_1",
      clerkId: "clerk_1",
      email: "learner@example.com",
      name: "Learner One",
      imageUrl: null,
      role: "STUDENT",
    });
    mocks.prisma.user.findUnique.mockResolvedValue({ stripeCustomerId: null });
    mocks.prisma.user.update.mockResolvedValue({});
    mocks.stripe.customers.create.mockResolvedValue({ id: "cus_123" });
    mocks.stripe.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.test/session",
    });
  });

  it("creates a Stripe customer and returns a portal session URL", async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ url: "https://billing.stripe.test/session" });
    expect(mocks.stripe.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "learner@example.com",
        metadata: { userId: "user_1", clerkId: "clerk_1" },
      }),
    );
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { stripeCustomerId: "cus_123" },
    });
    expect(mocks.stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_123" }),
    );
  });

  it("returns a helpful setup error when Stripe is not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("Stripe is not configured");
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("requires Supabase so Stripe customer IDs can be persisted", async () => {
    delete process.env.DATABASE_URL;

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("customer IDs can be persisted");
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });
});
