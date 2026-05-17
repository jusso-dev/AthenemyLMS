import { describe, expect, it } from "vitest";
import { capabilitiesForOrgRole, roleHasCapability } from "@/lib/enterprise";

describe("enterprise readiness", () => {
  it("maps organization roles to capabilities", () => {
    expect(capabilitiesForOrgRole("OWNER")).toContain("developer.manage");
    expect(roleHasCapability("INSTRUCTOR", "courses.manage")).toBe(true);
    expect(roleHasCapability("MEMBER", "audit.read")).toBe(false);
  });
});
