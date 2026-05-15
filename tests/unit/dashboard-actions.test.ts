import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    course: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    courseSection: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    lesson: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    lessonProgress: {
      upsert: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  };

  return {
    prisma,
    requireAppUser: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ requireAppUser: mocks.requireAppUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  createLessonAction,
  createSectionAction,
  markLessonCompleteAction,
  updateCourseAction,
} from "@/app/dashboard/courses/actions";

describe("dashboard course actions", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/athenemy";
    vi.clearAllMocks();
    mocks.requireAppUser.mockResolvedValue({
      id: "user_1",
      role: "INSTRUCTOR",
      clerkId: "clerk_1",
      email: "instructor@example.com",
      name: "Instructor",
      imageUrl: null,
    });
  });

  it("updates a course when the current instructor owns it", async () => {
    mocks.prisma.course.findUnique.mockResolvedValue({
      id: "course_1",
      instructorId: "user_1",
      publishedAt: null,
    });
    mocks.prisma.course.update.mockResolvedValue({});

    const formData = new FormData();
    formData.set("title", "Course Design Foundations");
    formData.set("slug", "course-design-foundations");
    formData.set("subtitle", "Build learning paths");
    formData.set("description", "A structured course");
    formData.set("priceCents", "4900");
    formData.set("status", "PUBLISHED");
    formData.set("thumbnailUrl", "");

    await updateCourseAction("course_1", formData);

    expect(mocks.prisma.course.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "course_1" },
        data: expect.objectContaining({
          title: "Course Design Foundations",
          slug: "course-design-foundations",
          priceCents: 4900,
          status: "PUBLISHED",
          publishedAt: expect.any(Date),
        }),
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/courses");
  });

  it("rejects section creation for a course the instructor does not own", async () => {
    mocks.prisma.course.findUnique.mockResolvedValue({
      id: "course_1",
      instructorId: "someone_else",
      _count: { sections: 0 },
    });

    const formData = new FormData();
    formData.set("title", "New section");

    await expect(createSectionAction("course_1", formData)).rejects.toThrow(
      "permission",
    );
    expect(mocks.prisma.courseSection.create).not.toHaveBeenCalled();
  });

  it("creates lessons with a generated slug and next section position", async () => {
    mocks.prisma.courseSection.findUnique.mockResolvedValue({
      id: "section_1",
      courseId: "course_1",
      course: { id: "course_1", instructorId: "user_1" },
      _count: { lessons: 2 },
    });
    mocks.prisma.lesson.create.mockResolvedValue({});

    const formData = new FormData();
    formData.set("title", "Map the syllabus");
    formData.set("durationMinutes", "12");
    formData.set("content", "Lesson notes");
    formData.set("videoUrl", "");

    await createLessonAction("section_1", formData);

    expect(mocks.prisma.lesson.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sectionId: "section_1",
        title: "Map the syllabus",
        slug: "map-the-syllabus",
        durationMinutes: 12,
        position: 2,
      }),
    });
  });

  it("requires enrollment or course ownership before marking a lesson complete", async () => {
    mocks.requireAppUser.mockResolvedValue({
      id: "student_1",
      role: "STUDENT",
      clerkId: "clerk_student",
      email: "student@example.com",
      name: "Student",
      imageUrl: null,
    });
    mocks.prisma.lesson.findUnique.mockResolvedValue({
      id: "lesson_1",
      section: {
        courseId: "course_1",
        course: { id: "course_1", instructorId: "user_1" },
      },
    });
    mocks.prisma.enrollment.findUnique.mockResolvedValue(null);

    await expect(markLessonCompleteAction("lesson_1")).rejects.toThrow(
      "enrolled",
    );
    expect(mocks.prisma.lessonProgress.upsert).not.toHaveBeenCalled();
  });
});
