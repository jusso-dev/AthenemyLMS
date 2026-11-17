import { afterEach, describe, expect, it, vi } from "vitest";
import { sendCoursePurchaseReceipt } from "@/lib/email";

describe("purchase email idempotency", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("passes stable delivery keys to the email provider", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "test-provider-key");
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "mail_1" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetch);
    await sendCoursePurchaseReceipt({
      to: "learner@example.test",
      courseTitle: "Course",
      idempotencyKey: "purchase-receipt/payment_1",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": "purchase-receipt/payment_1",
        }),
      }),
    );
  });
  it("fails closed when production email delivery is left in stub mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", "stub");
    await expect(
      sendCoursePurchaseReceipt({ to: "learner@example.test" }),
    ).rejects.toThrow("production email provider");
  });
});
