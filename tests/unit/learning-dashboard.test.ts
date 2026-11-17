import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  course: { findMany: vi.fn(), count: vi.fn() },
  enrollment: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  payment: { aggregate: vi.fn() },
  assessment: { findMany: vi.fn() },
  assessmentSubmission: { findMany: vi.fn() },
  lessonProgress: { findMany: vi.fn() },
  certificate: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks }));
import {
  getDashboardOverview,
  getManageCourses,
  getMyCourses,
} from "@/lib/dashboard-data";
const student = {
  id: "student",
  role: "STUDENT" as const,
  name: null,
  imageUrl: null,
  email: "student@example.test",
  clerkId: "clerk-student",
};

describe("learning dashboard data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://local/test";
    mocks.course.findMany.mockResolvedValue([]);
    mocks.course.count.mockResolvedValue(0);
    mocks.enrollment.count.mockResolvedValue(0);
    mocks.payment.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } });
  });

  it("does not query organisation data for an anonymous user", async () => {
    await getDashboardOverview(null);
    expect(mocks.payment.aggregate).not.toHaveBeenCalled();
    expect(mocks.course.findMany).not.toHaveBeenCalled();
  });

  it("limits learner enrollment and payment summaries to that learner", async () => {
    await getDashboardOverview(student);
    expect(mocks.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "student" }),
      }),
    );
    expect(mocks.enrollment.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "student" }),
      }),
    );
  });

  it("combines organisation management scope with search instead of replacing it", async () => {
    await getManageCourses(
      {
        ...student,
        organizationMemberships: [{ organizationId: "org-1", role: "OWNER" }],
      },
      "Course",
    );
    const where = mocks.course.findMany.mock.calls[0][0].where;
    expect(where.AND[0].OR).toContainEqual({
      organizationId: { in: ["org-1"] },
    });
    expect(where.AND[1].OR).toContainEqual({
      title: { contains: "Course", mode: "insensitive" },
    });
  });

  it("keeps fully read courses active until required assessments pass and stops offering completed lessons as resume points", async () => {
    mocks.enrollment.findMany.mockResolvedValue([
      {
        courseId: "course",
        status: "ACTIVE",
        createdAt: new Date(),
        course: { id: "course", sections: [{ lessons: [{ id: "lesson" }] }] },
      },
    ]);
    mocks.lessonProgress.findMany.mockResolvedValue([{ lessonId: "lesson" }]);
    mocks.assessment.findMany.mockResolvedValue([
      { id: "assessment", courseId: "course", title: "Required" },
    ]);
    mocks.assessmentSubmission.findMany.mockResolvedValue([]);
    mocks.certificate.findMany.mockResolvedValue([]);
    const result = await getMyCourses(student);
    expect(result.courses[0]).toMatchObject({
      complete: false,
      nextLesson: null,
      progressPercent: 100,
    });
    expect(result.summary).toMatchObject({
      activeCourses: 1,
      completedCourses: 0,
      requiredWork: 1,
    });
    mocks.assessmentSubmission.findMany.mockResolvedValue([
      { assessmentId: "assessment" },
    ]);
    expect((await getMyCourses(student)).summary).toMatchObject({
      activeCourses: 0,
      completedCourses: 1,
      requiredWork: 0,
    });
  });
});
