"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assessmentSchema, courseSchema } from "@/lib/course-schemas";
import { missingEnv } from "@/lib/env";
import { canManageCourse, hasRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { parseQuizOptions, scoreQuiz } from "@/lib/assessments";

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

export async function createAssessmentAction(courseId: string, formData: FormData) {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    throw new Error("Supabase is not configured. Add DATABASE_URL to .env.local.");
  }

  const user = await requireAppUser();
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!canManageCourse(user, course)) {
    throw new Error("You do not have permission to manage this course.");
  }

  const parsed = assessmentSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    prompt: formData.get("prompt"),
    options: formData.get("options"),
    correctIndex: formData.get("correctIndex"),
    passingScore: formData.get("passingScore"),
    requiredForCompletion: formData.get("requiredForCompletion") === "on",
  });
  const options = parseQuizOptions(parsed.options);
  if (parsed.correctIndex >= options.length) {
    throw new Error("Correct answer must match one of the provided options.");
  }

  await prisma.assessment.create({
    data: {
      courseId,
      title: parsed.title,
      description: parsed.description || null,
      passingScore: parsed.passingScore,
      requiredForCompletion: parsed.requiredForCompletion,
      questions: {
        create: {
          prompt: parsed.prompt,
          options,
          correctIndex: parsed.correctIndex,
        },
      },
    },
  });

  revalidatePath(`/dashboard/courses/${courseId}/assessments`);
  revalidatePath(`/dashboard/learn/${courseId}`);
}

export async function submitAssessmentAction(
  courseId: string,
  assessmentId: string,
  formData: FormData,
) {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    throw new Error("Supabase is not configured. Add DATABASE_URL to .env.local.");
  }

  const user = await requireAppUser();
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { questions: true },
  });
  if (!assessment || assessment.courseId !== courseId) {
    throw new Error("Assessment not found.");
  }

  const answers = Object.fromEntries(
    assessment.questions.map((question) => [
      question.id,
      Number(formData.get(`question-${question.id}`)),
    ]),
  );
  const score = scoreQuiz(assessment.questions, answers);
  const passed = score >= assessment.passingScore;

  await prisma.assessmentSubmission.create({
    data: {
      assessmentId,
      userId: user.id,
      answers,
      score,
      passed,
    },
  });

  revalidatePath(`/dashboard/learn/${courseId}/assessments/${assessmentId}`);
  revalidatePath(`/dashboard/learn/${courseId}`);
}
