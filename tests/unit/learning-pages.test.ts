import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  getLearnCourse: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  prisma: {
    assessment: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn(), findFirst: vi.fn() },
    externalPackage: { findUnique: vi.fn() },
    externalPackageAttempt: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  getCurrentAppUser: mocks.user,
  requireAppUser: mocks.user,
}));
vi.mock("@/lib/dashboard-data", () => ({
  getLearnCourse: mocks.getLearnCourse,
  databaseIsConfigured: () => true,
  fallbackNotice: () => ({}),
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import TakeAssessmentPage from "@/app/dashboard/learn/[courseId]/assessments/[assessmentId]/page";
import LessonPlayerPage from "@/app/dashboard/learn/[courseId]/lessons/[lessonId]/page";
import ScormLaunchPage from "@/app/dashboard/learn/[courseId]/scorm/[packageId]/page";

describe("learner route boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://local/test";
    mocks.user.mockResolvedValue({ id: "student", role: "STUDENT" });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "student",
      clerkId: "student",
      role: "STUDENT",
      organizationMemberships: [],
    });
    mocks.prisma.enrollment.findFirst.mockImplementation(() =>
      mocks.prisma.enrollment.findUnique(),
    );
    mocks.prisma.assessment.findUnique.mockResolvedValue({
      id: "assessment",
      courseId: "course",
      course: { instructorId: "teacher" },
    });
  });

  it.each([null, { status: "CANCELLED" }])(
    "does not render assessments to an unenrolled or revoked learner",
    async (enrollment) => {
      mocks.prisma.enrollment.findUnique.mockResolvedValue(enrollment);
      await expect(
        TakeAssessmentPage({
          params: Promise.resolve({
            courseId: "course",
            assessmentId: "assessment",
          }),
        }),
      ).rejects.toThrow("NOT_FOUND");
    },
  );

  it("returns not found for a lesson absent from the requested course", async () => {
    mocks.getLearnCourse.mockResolvedValue({
      mode: "database",
      course: { sections: [{ lessons: [{ id: "first-lesson" }] }] },
      completedLessonIds: [],
    });
    await expect(
      LessonPlayerPage({
        params: Promise.resolve({
          courseId: "course",
          lessonId: "missing-lesson",
        }),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it.each([
    ["READY", "CANCELLED"],
    ["DISABLED", "ACTIVE"],
  ])(
    "denies SCORM launch for %s package and %s enrollment",
    async (packageStatus, enrollmentStatus) => {
      mocks.prisma.externalPackage.findUnique.mockResolvedValue({
        id: "package",
        courseId: "course",
        status: packageStatus,
        course: { instructorId: "teacher" },
      });
      mocks.prisma.enrollment.findUnique.mockResolvedValue({
        status: enrollmentStatus,
      });
      await expect(
        ScormLaunchPage({
          params: Promise.resolve({ courseId: "course", packageId: "package" }),
        }),
      ).rejects.toThrow("NOT_FOUND");
      expect(mocks.prisma.externalPackageAttempt.upsert).not.toHaveBeenCalled();
    },
  );
});
