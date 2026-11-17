import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  canAuthorCourses,
  canManageCourse,
  hasRole,
  resolvePlatformRole,
} from "@/lib/permissions";

describe("permissions", () => {
  it("requires an explicit operator grant for platform administration, including legacy ADMIN records", () => {
    expect(resolvePlatformRole("ADMIN", "legacy_owner")).toBe("STUDENT");
    expect(
      resolvePlatformRole("STUDENT", "operator", "operator, another_operator"),
    ).toBe("ADMIN");
    expect(resolvePlatformRole("ADMIN", "legacy_owner", "operator")).toBe(
      "STUDENT",
    );
    expect(resolvePlatformRole("INSTRUCTOR", "instructor")).toBe("INSTRUCTOR");
  });
  it("grants organisation owners authoring without platform administration", () => {
    const owner = {
      id: "owner",
      role: "STUDENT" as const,
      organizationMemberships: [
        { organizationId: "org_one", role: "OWNER" as const },
      ],
    };
    expect(canAuthorCourses(owner)).toBe(true);
    expect(canAccessAdmin(owner.role)).toBe(false);
    expect(
      canManageCourse(owner, {
        instructorId: "instructor",
        organizationId: "org_one",
      }),
    ).toBe(true);
    expect(
      canManageCourse(owner, {
        instructorId: "instructor",
        organizationId: "org_two",
      }),
    ).toBe(false);
  });

  it("requires current organisation membership for organisation course ownership", () => {
    const instructor = {
      id: "instructor",
      role: "INSTRUCTOR" as const,
      organizationMemberships: [],
    };
    expect(
      canManageCourse(instructor, {
        instructorId: "instructor",
        organizationId: "org_one",
      }),
    ).toBe(false);
    expect(
      canManageCourse(instructor, {
        instructorId: "instructor",
        organizationId: null,
      }),
    ).toBe(true);
  });
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
