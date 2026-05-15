"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { courseSchema } from "@/lib/course-schemas";
import { missingEnv } from "@/lib/env";
import { hasRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { sendCoursePublishedEmail } from "@/lib/email";

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

  if (course.status === "PUBLISHED") {
    await sendCoursePublishedEmail({
      to: user.email,
      name: user.name ?? undefined,
      courseTitle: course.title,
    });
  }

  revalidatePath("/dashboard/courses");
  redirect(`/dashboard/courses/${course.id}/edit`);
}
