import { describe, expect, it } from "vitest";
import { missingEnv } from "@/lib/env";

describe("stripe webhook setup", () => {
  it("reports missing webhook secrets in local setup mode", () => {
    expect(missingEnv(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]).length).toBeGreaterThan(0);
  });
});
