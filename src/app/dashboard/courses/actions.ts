"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  courseSchema,
  lessonSchema,
  profileSchema,
  sectionSchema,
} from "@/lib/course-schemas";
import { missingEnv } from "@/lib/env";
import { canManageCourse, hasRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";

export async function createCourseAction(formData: FormData) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  if (!hasRole(user.role, "INSTRUCTOR")) {
    throw new Error("Instructor or admin role required.");
  }

  const parsed = courseSchema.parse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    subtitle: formData.get("subtitle"),
    description: formData.get("description"),
    priceCents: formData.get("priceCents"),
    status: formData.get("status"),
    thumbnailUrl: formData.get("thumbnailUrl"),
  });

  const course = await prisma.course.create({
    data: {
      ...parsed,
      instructorId: user.id,
      publishedAt: parsed.status === "PUBLISHED" ? new Date() : null,
    },
  });

  revalidatePath("/dashboard/courses");
  redirect(`/dashboard/courses/${course.id}/edit`);
}

export async function updateCourseAction(courseId: string, formData: FormData) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!canManageCourse(user, course)) {
    throw new Error("You do not have permission to manage this course.");
  }

  const parsed = courseSchema.parse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    subtitle: formData.get("subtitle"),
    description: formData.get("description"),
    priceCents: formData.get("priceCents"),
    status: formData.get("status"),
    thumbnailUrl: formData.get("thumbnailUrl"),
  });

  await prisma.course.update({
    where: { id: courseId },
    data: {
      ...parsed,
      publishedAt:
        parsed.status === "PUBLISHED" && course?.publishedAt === null
          ? new Date()
          : course?.publishedAt,
    },
  });

  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${courseId}/edit`);
}

export async function createSectionAction(courseId: string, formData: FormData) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { _count: { select: { sections: true } } },
  });
  if (!course || !canManageCourse(user, course)) {
    throw new Error("You do not have permission to manage this course.");
  }

  const parsed = sectionSchema.parse({ title: formData.get("title") });
  await prisma.courseSection.create({
    data: {
      courseId,
      title: parsed.title,
      position: course._count.sections,
    },
  });

  revalidatePath(`/dashboard/courses/${courseId}/curriculum`);
}

export async function createLessonAction(sectionId: string, formData: FormData) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const section = await prisma.courseSection.findUnique({
    where: { id: sectionId },
    include: {
      course: true,
      _count: { select: { lessons: true } },
    },
  });
  if (!section || !canManageCourse(user, section.course)) {
    throw new Error("You do not have permission to manage this course.");
  }

  const title = String(formData.get("title") ?? "");
  const parsed = lessonSchema.parse({
    title,
    slug: formData.get("slug") || slugify(title),
    content: formData.get("content") ?? "",
    videoUrl: formData.get("videoUrl") ?? "",
    durationMinutes: formData.get("durationMinutes") ?? 0,
    preview: formData.get("preview") === "on",
  });

  await prisma.lesson.create({
    data: {
      ...parsed,
      sectionId,
      position: section._count.lessons,
    },
  });

  revalidatePath(`/dashboard/courses/${section.courseId}/curriculum`);
}

export async function updateProfileAction(formData: FormData) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const parsed = profileSchema.parse({
    name: formData.get("name"),
    websiteUrl: formData.get("websiteUrl"),
    bio: formData.get("bio"),
  });

  await prisma.user.update({
    where: { id: user.id },
    data: parsed,
  });

  revalidatePath("/dashboard/settings");
}

export async function markLessonCompleteAction(lessonId: string) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { section: { include: { course: true } } },
  });
  if (!lesson) throw new Error("Lesson not found.");

  const canManage = canManageCourse(user, lesson.section.course);
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: user.id,
        courseId: lesson.section.courseId,
      },
    },
  });

  if (!canManage && !enrollment) {
    throw new Error("You must be enrolled to complete this lesson.");
  }

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    create: {
      userId: user.id,
      lessonId,
      completedAt: new Date(),
    },
    update: {
      completedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  revalidatePath(`/dashboard/learn/${lesson.section.courseId}`);
  revalidatePath(`/dashboard/learn/${lesson.section.courseId}/lessons/${lessonId}`);
}

function assertDatabaseConfigured() {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    throw new Error("Supabase is not configured. Add DATABASE_URL to .env.local.");
  }
}
