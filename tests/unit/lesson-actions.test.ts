import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    lesson: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  requireAppUser: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ requireAppUser: mocks.requireAppUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { updateLessonContentAction } from "@/app/dashboard/courses/actions";

describe("lesson content actions", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/athenemy";
    vi.clearAllMocks();
    mocks.requireAppUser.mockResolvedValue({
      id: "instructor_1",
      role: "INSTRUCTOR",
      clerkId: "clerk_1",
      email: "instructor@example.com",
      name: "Instructor",
      imageUrl: null,
    });
    mocks.prisma.lesson.findUnique.mockResolvedValue({
      id: "lesson_1",
      section: {
        courseId: "course_1",
        course: { id: "course_1", instructorId: "instructor_1" },
      },
    });
    mocks.prisma.lesson.update.mockResolvedValue({});
  });

  it("persists validated Markdown lesson content for the owning instructor", async () => {
    const formData = new FormData();
    formData.set("title", "Write useful outcomes");
    formData.set("slug", "write-useful-outcomes");
    formData.set("content", "## Outcomes\n\n- Draft one measurable outcome");
    formData.set("videoUrl", "");
    formData.set("durationMinutes", "12");
    formData.set("preview", "on");

    await updateLessonContentAction("course_1", "lesson_1", formData);

    expect(mocks.prisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "lesson_1" },
      data: expect.objectContaining({
        title: "Write useful outcomes",
        content: "## Outcomes\n\n- Draft one measurable outcome",
        durationMinutes: 12,
        preview: true,
      }),
    });
  });

  it("rejects edits for lessons outside the requested course", async () => {
    mocks.prisma.lesson.findUnique.mockResolvedValue({
      id: "lesson_1",
      section: {
        courseId: "course_2",
        course: { id: "course_2", instructorId: "instructor_1" },
      },
    });

    const formData = new FormData();
    formData.set("title", "Write useful outcomes");
    formData.set("slug", "write-useful-outcomes");
    formData.set("content", "Content");
    formData.set("durationMinutes", "12");

    await expect(
      updateLessonContentAction("course_1", "lesson_1", formData),
    ).rejects.toThrow("Lesson not found");
    expect(mocks.prisma.lesson.update).not.toHaveBeenCalled();
  });
});
