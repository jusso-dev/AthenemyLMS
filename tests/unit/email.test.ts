import { afterEach, describe, expect, it, vi } from "vitest";
import {
  sendCoursePublishedEmail,
  sendEnrollmentEmail,
  sendWelcomeEmail,
} from "@/lib/email";

const originalEnv = { ...process.env };

describe("transactional email", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses the safe stub provider in test mode", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("EMAIL_PROVIDER", "resend");

    await expect(
      sendWelcomeEmail({ to: "learner@example.com", name: "Learner" }),
    ).resolves.toMatchObject({
      provider: "stub",
      event: "welcome",
      accepted: true,
    });
  });

  it("sends Resend payloads when configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_FROM", "Athenemy <hello@example.com>");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), { status: 200 }),
    );

    await expect(
      sendEnrollmentEmail({
        to: "learner@example.com",
        courseTitle: "Course Design Foundations",
      }),
    ).resolves.toMatchObject({
      provider: "resend",
      event: "enrollment",
      id: "email_123",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer re_test_key",
        }),
      }),
    );
  });

  it("raises actionable production setup errors", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", undefined);

    await expect(
      sendCoursePublishedEmail({
        to: "instructor@example.com",
        courseTitle: "Course Design Foundations",
      }),
    ).rejects.toThrow("RESEND_API_KEY");
  });
});
