"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { courseSchema, lessonContentSchema } from "@/lib/course-schemas";
import { missingEnv } from "@/lib/env";
import { canManageCourse, hasRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";

export async function createCourseAction(formData: FormData) {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    throw new Error("Supabase is not configured. Add DATABASE_URL to .env.local.");
  }

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

export async function updateLessonContentAction(
  courseId: string,
  lessonId: string,
  formData: FormData,
) {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    throw new Error("Supabase is not configured. Add DATABASE_URL to .env.local.");
  }

  const user = await requireAppUser();
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { section: { include: { course: true } } },
  });
  if (!lesson || lesson.section.courseId !== courseId) {
    throw new Error("Lesson not found.");
  }
  if (!canManageCourse(user, lesson.section.course)) {
    throw new Error("You do not have permission to edit this lesson.");
  }

  const parsed = lessonContentSchema.parse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    content: formData.get("content") ?? "",
    videoUrl: formData.get("videoUrl") ?? "",
    durationMinutes: formData.get("durationMinutes") ?? 0,
    preview: formData.get("preview") === "on",
  });

  await prisma.lesson.update({
    where: { id: lessonId },
    data: parsed,
  });

  revalidatePath(`/dashboard/courses/${courseId}/lessons/${lessonId}/edit`);
  revalidatePath(`/dashboard/learn/${courseId}/lessons/${lessonId}`);
}
