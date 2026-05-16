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
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    lesson: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
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
    $transaction: vi.fn(async (operations: unknown[]) => operations),
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
  createCourseAction,
  createCourseFormAction,
  createLessonAction,
  createSectionAction,
  markLessonCompleteAction,
  moveLessonFormAction,
  moveSectionFormAction,
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

  it("returns a form error instead of throwing when course creation is not allowed", async () => {
    mocks.requireAppUser.mockResolvedValue({
      id: "student_1",
      role: "STUDENT",
      clerkId: "clerk_student",
      email: "student@example.com",
      name: "Student",
      imageUrl: null,
    });

    const formData = new FormData();
    formData.set("title", "Course Design Foundations");
    formData.set("slug", "course-design-foundations");
    formData.set("subtitle", "Build learning paths");
    formData.set("description", "A structured course");
    formData.set("priceCents", "4900");
    formData.set("status", "DRAFT");
    formData.set("thumbnailUrl", "");

    await expect(
      createCourseFormAction({ status: "idle", message: null }, formData),
    ).resolves.toEqual({
      status: "error",
      message: "Instructor or admin role required.",
    });
    expect(mocks.prisma.course.create).not.toHaveBeenCalled();
  });

  it("redirects back with a friendly error when direct course creation validation fails", async () => {
    const formData = new FormData();
    formData.set("title", "");
    formData.set("slug", "");
    formData.set("subtitle", "");
    formData.set("description", "");
    formData.set("priceCents", "0");
    formData.set("status", "DRAFT");
    formData.set("thumbnailUrl", "");

    await createCourseAction(formData);

    expect(mocks.redirect).toHaveBeenCalledWith(
      expect.stringContaining("/dashboard/courses/new?error="),
    );
    expect(decodeURIComponent(mocks.redirect.mock.calls[0][0])).toContain(
      "Use at least 3 characters",
    );
    expect(mocks.prisma.course.create).not.toHaveBeenCalled();
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

  it("moves a section and persists normalized section positions", async () => {
    mocks.prisma.course.findUnique.mockResolvedValue({
      id: "course_1",
      instructorId: "user_1",
      sections: [
        { id: "section_1", position: 0 },
        { id: "section_2", position: 1 },
        { id: "section_3", position: 2 },
      ],
    });
    mocks.prisma.courseSection.update.mockImplementation((input) => input);

    await expect(
      moveSectionFormAction(
        "course_1",
        "section_2",
        "up",
        { status: "idle", message: null },
        new FormData(),
      ),
    ).resolves.toEqual({
      status: "success",
      message: "Section order saved.",
    });

    expect(mocks.prisma.courseSection.update).toHaveBeenCalledTimes(3);
    expect(mocks.prisma.courseSection.update).toHaveBeenNthCalledWith(1, {
      where: { id: "section_2" },
      data: { position: 0 },
    });
    expect(mocks.prisma.courseSection.update).toHaveBeenNthCalledWith(2, {
      where: { id: "section_1" },
      data: { position: 1 },
    });
    expect(mocks.prisma.courseSection.update).toHaveBeenNthCalledWith(3, {
      where: { id: "section_3" },
      data: { position: 2 },
    });
  });

  it("moves a lesson across adjacent sections and normalizes lesson positions", async () => {
    mocks.prisma.lesson.findUnique.mockResolvedValue({
      id: "lesson_2",
      section: {
        courseId: "course_1",
        course: { id: "course_1", instructorId: "user_1" },
      },
    });
    mocks.prisma.courseSection.findMany.mockResolvedValue([
      {
        id: "section_1",
        lessons: [
          { id: "lesson_1", position: 0 },
          { id: "lesson_2", position: 1 },
        ],
      },
      {
        id: "section_2",
        lessons: [{ id: "lesson_3", position: 0 }],
      },
    ]);
    mocks.prisma.lesson.update.mockImplementation((input) => input);

    await expect(
      moveLessonFormAction(
        "course_1",
        "lesson_2",
        "down",
        { status: "idle", message: null },
        new FormData(),
      ),
    ).resolves.toEqual({
      status: "success",
      message: "Lesson order saved.",
    });

    expect(mocks.prisma.lesson.update).toHaveBeenCalledTimes(3);
    expect(mocks.prisma.lesson.update).toHaveBeenNthCalledWith(1, {
      where: { id: "lesson_1" },
      data: { sectionId: "section_1", position: 0 },
    });
    expect(mocks.prisma.lesson.update).toHaveBeenNthCalledWith(2, {
      where: { id: "lesson_2" },
      data: { sectionId: "section_2", position: 0 },
    });
    expect(mocks.prisma.lesson.update).toHaveBeenNthCalledWith(3, {
      where: { id: "lesson_3" },
      data: { sectionId: "section_2", position: 1 },
    });
  });
});
