import { describe, expect, it } from "vitest";
import { productionIssues } from "../../scripts/check-production.mjs";

function configured() {
  return {
    DATABASE_URL: "postgresql://localhost/verification",
    DIRECT_URL: "postgresql://localhost/verification",
    NEXT_PUBLIC_APP_URL: "https://learning.school.test",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "configured",
    CLERK_SECRET_KEY: "configured",
    CLOUDFLARE_R2_ACCOUNT_ID: "configured",
    CLOUDFLARE_R2_ACCESS_KEY_ID: "configured",
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: "configured",
    CLOUDFLARE_R2_BUCKET_NAME: "configured",
    CLOUDFLARE_R2_PUBLIC_BASE_URL: "https://media.school.test",
    EMAIL_PROVIDER: "resend",
    EMAIL_FROM: "Learning <learning@school.test>",
    RESEND_API_KEY: "configured",
    SCORM_STORAGE_DIR: "/srv/athenemy/scorm",
    WEBHOOK_ENCRYPTION_KEY: "A".repeat(43) + "=",
  };
}

describe("production configuration", () => {
  it("accepts a complete free-learning deployment", () => {
    expect(productionIssues(configured())).toEqual([]);
  });
  it("rejects setup mode, stub email and partially configured commerce", () => {
    expect(productionIssues({})).toContain("DATABASE_URL must be configured.");
    expect(
      productionIssues({ ...configured(), EMAIL_PROVIDER: "stub" }),
    ).toHaveLength(1);
    expect(
      productionIssues({ ...configured(), STRIPE_SECRET_KEY: "configured" }),
    ).toHaveLength(2);
  });
  it("rejects ephemeral relative SCORM storage and malformed webhook keys", () => {
    const issues = productionIssues({
      ...configured(),
      SCORM_STORAGE_DIR: ".private/scorm",
      WEBHOOK_ENCRYPTION_KEY: "invalid",
    });
    expect(issues).toHaveLength(2);
  });
  it("validates URL shapes without exposing supplied values", () => {
    const issues = productionIssues({
      ...configured(),
      DIRECT_URL: "invalid-connection-value",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });
    expect(issues).toHaveLength(2);
    expect(issues.join(" ")).not.toContain("invalid-connection-value");
  });
});
