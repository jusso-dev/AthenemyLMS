import { describe, expect, it } from "vitest";
import { canAccessAdmin, canManageCourse, hasRole } from "@/lib/permissions";

describe("permissions", () => {
  it("treats admin as the highest role", () => {
    expect(hasRole("ADMIN", "INSTRUCTOR")).toBe(true);
    expect(hasRole("STUDENT", "INSTRUCTOR")).toBe(false);
  });

  it("limits admin access to admins", () => {
    expect(canAccessAdmin("ADMIN")).toBe(true);
    expect(canAccessAdmin("INSTRUCTOR")).toBe(false);
  });

  it("allows instructors to manage their own courses", () => {
    expect(
      canManageCourse(
        { id: "user_1", role: "INSTRUCTOR" },
        { instructorId: "user_1" },
      ),
    ).toBe(true);
    expect(
      canManageCourse(
        { id: "user_2", role: "INSTRUCTOR" },
        { instructorId: "user_1" },
      ),
    ).toBe(false);
  });
});
