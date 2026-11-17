import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  enrollment: { findUnique: vi.fn() },
  course: { findUnique: vi.fn() },
  lesson: { findFirst: vi.fn() },
  discussionThread: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks }));
import { createDiscussionThread } from "@/lib/social-learning";

const input = {
  actor: {
    id: "student",
    clerkId: "student",
    role: "STUDENT" as const,
    email: "student@school.test",
    name: null,
    imageUrl: null,
  },
  courseId: "course",
  title: "Lesson discussion",
  body: "A question about this lesson.",
};
describe("course discussions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.enrollment.findUnique.mockResolvedValue({
      status: "ACTIVE",
      course: { id: "course", organizationId: "org", instructorId: "teacher" },
    });
  });
  it("lets an enrolled learner start a course discussion", async () => {
    await createDiscussionThread(input);
    expect(mocks.discussionThread.create).toHaveBeenCalledOnce();
  });
  it("respects cancelled course access", async () => {
    mocks.enrollment.findUnique.mockResolvedValue({
      status: "CANCELLED",
      course: { id: "course", organizationId: "org", instructorId: "teacher" },
    });
    await expect(createDiscussionThread(input)).rejects.toThrow(
      "Enrollment is required",
    );
    expect(mocks.discussionThread.create).not.toHaveBeenCalled();
  });
  it("requires a lesson associated with the selected course", async () => {
    mocks.lesson.findFirst.mockResolvedValue(null);
    await expect(
      createDiscussionThread({ ...input, lessonId: "unavailable-lesson" }),
    ).rejects.toThrow("Lesson not found");
    expect(mocks.lesson.findFirst).toHaveBeenCalledWith({
      where: { id: "unavailable-lesson", section: { courseId: "course" } },
      select: { id: true },
    });
    expect(mocks.discussionThread.create).not.toHaveBeenCalled();
  });
});
