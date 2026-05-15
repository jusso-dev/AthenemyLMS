"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { courseSchema, lessonVideoSchema } from "@/lib/course-schemas";
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

export async function updateLessonVideoAction(
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
    throw new Error("You do not have permission to manage this lesson.");
  }

  const parsed = lessonVideoSchema.parse({
    videoUrl: formData.get("videoUrl") ?? "",
    videoProvider: formData.get("videoProvider") ?? "EXTERNAL",
    videoAssetKey: formData.get("videoAssetKey") ?? "",
    videoMimeType: formData.get("videoMimeType") ?? "",
    videoBytes: formData.get("videoBytes") || undefined,
  });

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      videoUrl: parsed.videoUrl || null,
      videoProvider: parsed.videoUrl ? parsed.videoProvider : null,
      videoAssetKey: parsed.videoAssetKey || null,
      videoMimeType: parsed.videoMimeType || null,
      videoBytes:
        typeof parsed.videoBytes === "number" ? parsed.videoBytes : null,
    },
  });

  revalidatePath(`/dashboard/courses/${courseId}/lessons/${lessonId}/video`);
  revalidatePath(`/dashboard/learn/${courseId}/lessons/${lessonId}`);
}
