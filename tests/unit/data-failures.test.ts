import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  missingEnv: vi.fn(),
  course: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  enrollment: { findMany: vi.fn() },
}));
vi.mock("@/lib/env", () => ({ missingEnv: mocks.missingEnv }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks }));
import { getPublishedCourses, getCourseBySlug } from "@/lib/course-data";
import { getManageCourses, getMyCourses } from "@/lib/dashboard-data";

describe("data failures", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.missingEnv.mockReturnValue([]);
    mocks.course.count.mockResolvedValue(1);
    mocks.course.findMany.mockRejectedValue(new Error("Database unavailable"));
    mocks.course.findFirst.mockRejectedValue(new Error("Database unavailable"));
    mocks.enrollment.findMany.mockRejectedValue(
      new Error("Database unavailable"),
    );
  });
  it("preserves intentional unconfigured setup states", async () => {
    mocks.missingEnv.mockReturnValue(["DATABASE_URL"]);
    expect(await getPublishedCourses()).toEqual([]);
    expect(await getCourseBySlug("course")).toBeNull();
    expect(mocks.course.findMany).not.toHaveBeenCalled();
  });
  it("surfaces configured catalogue failures instead of pretending courses are absent", async () => {
    await expect(getPublishedCourses()).rejects.toThrow("Database unavailable");
    await expect(getCourseBySlug("course")).rejects.toThrow(
      "Database unavailable",
    );
  });
  it("surfaces dashboard failures to the retry boundary instead of setup mode", async () => {
    const user = {
      id: "teacher",
      role: "INSTRUCTOR" as const,
      clerkId: "teacher",
      email: "teacher@school.test",
      name: null,
      imageUrl: null,
    };
    await expect(getManageCourses(user)).rejects.toThrow(
      "Database unavailable",
    );
    await expect(getMyCourses(user)).rejects.toThrow("Database unavailable");
  });
});
