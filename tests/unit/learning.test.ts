vi.mock("@/lib/learning-events", () => ({ recordCourseEvent: vi.fn() }));
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    enrollment: { findUnique: vi.fn(), update: vi.fn() },
    externalPackage: { findMany: vi.fn(), count: vi.fn() },
    lesson: { count: vi.fn(), findUnique: vi.fn() },
    lessonProgress: { count: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    assessment: { findMany: vi.fn() },
  },
  requireAppUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ requireAppUser: mocks.requireAppUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import {
  hasLearningAccess,
  learningTransaction,
  reconcileLearningCompletion,
} from "@/lib/learning";
import { markLessonCompleteAction } from "@/app/dashboard/courses/actions";

describe("learning completion and access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.externalPackage.findMany.mockResolvedValue([]);
    mocks.prisma.externalPackage.count.mockResolvedValue(0);
    process.env.DATABASE_URL = "postgresql://local/test";
    mocks.prisma.$transaction.mockImplementation((operation) =>
      operation(mocks.prisma),
    );
    mocks.prisma.enrollment.findUnique.mockResolvedValue({ status: "ACTIVE" });
    mocks.prisma.lesson.count.mockResolvedValue(2);
    mocks.prisma.lessonProgress.count.mockResolvedValue(2);
    mocks.prisma.assessment.findMany.mockResolvedValue([]);
    mocks.requireAppUser.mockResolvedValue({ id: "student", role: "STUDENT" });
    mocks.prisma.lesson.findUnique.mockResolvedValue({
      id: "lesson",
      section: { courseId: "course", course: { instructorId: "teacher" } },
    });
  });

  it("only active and completed enrollments grant learning access", () => {
    expect(hasLearningAccess(null)).toBe(false);
    expect(hasLearningAccess({ status: "CANCELLED" })).toBe(false);
    expect(hasLearningAccess({ status: "ACTIVE" })).toBe(true);
    expect(hasLearningAccess({ status: "COMPLETED" })).toBe(true);
  });

  it("completes an enrollment when its final lesson is completed", async () => {
    await markLessonCompleteAction("lesson");
    expect(mocks.prisma.enrollment.update).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: "student", courseId: "course" } },
      data: { status: "COMPLETED" },
    });
    expect(mocks.prisma.lessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { lastSeenAt: expect.any(Date) } }),
    );
    expect(mocks.prisma.lessonProgress.updateMany).toHaveBeenCalledWith({
      where: { userId: "student", lessonId: "lesson", completedAt: null },
      data: { completedAt: expect.any(Date) },
    });
  });

  it("keeps the enrollment active while required assessments remain", async () => {
    mocks.prisma.assessment.findMany.mockResolvedValue([
      { id: "assessment", title: "Final assessment" },
    ]);
    await markLessonCompleteAction("lesson");
    expect(mocks.prisma.enrollment.update).not.toHaveBeenCalled();
  });

  it("does not complete an empty course", async () => {
    mocks.prisma.lesson.count.mockResolvedValue(0);
    mocks.prisma.lessonProgress.count.mockResolvedValue(0);
    await learningTransaction((database) =>
      reconcileLearningCompletion(database, "student", "course"),
    );
    expect(mocks.prisma.enrollment.update).not.toHaveBeenCalled();
  });

  it("denies lesson completion after access is cancelled", async () => {
    mocks.prisma.enrollment.findUnique.mockResolvedValue({
      status: "CANCELLED",
    });
    await expect(markLessonCompleteAction("lesson")).rejects.toThrow(
      "enrolled",
    );
    expect(mocks.prisma.lessonProgress.upsert).not.toHaveBeenCalled();
  });

  it("allows a course manager to preview without enrolling them", async () => {
    mocks.requireAppUser.mockResolvedValue({
      id: "teacher",
      role: "INSTRUCTOR",
    });
    mocks.prisma.enrollment.findUnique.mockResolvedValue(null);
    await markLessonCompleteAction("lesson");
    expect(mocks.prisma.lessonProgress.upsert).toHaveBeenCalled();
    expect(mocks.prisma.enrollment.update).not.toHaveBeenCalled();
  });

  it("retries serialization conflicts with a new transaction", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("Conflict", {
      code: "P2034",
      clientVersion: "test",
    });
    mocks.prisma.$transaction.mockRejectedValueOnce(conflict);
    const operation = vi.fn().mockResolvedValue("saved");
    await expect(learningTransaction(operation)).resolves.toBe("saved");
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(operation, {
      isolationLevel: "Serializable",
    });
  });

  it("bounds transaction retries and propagates non-conflict failures", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("Conflict", {
      code: "P2034",
      clientVersion: "test",
    });
    mocks.prisma.$transaction.mockRejectedValue(conflict);
    await expect(learningTransaction(async () => undefined)).rejects.toBe(
      conflict,
    );
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(3);
    mocks.prisma.$transaction
      .mockClear()
      .mockRejectedValue(new Error("Unavailable"));
    await expect(learningTransaction(async () => undefined)).rejects.toThrow(
      "Unavailable",
    );
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
