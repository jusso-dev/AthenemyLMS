import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const actor = vi.hoisted(() => ({ id: "", role: "STUDENT" as const }));
vi.mock("@/lib/auth", () => ({ requireAppUser: async () => actor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { prisma } from "@/lib/prisma";
import {
  markLessonCompleteAction,
  submitAssessmentAction,
} from "@/app/dashboard/courses/actions";
import { issueCertificate } from "@/lib/certificates";
import { getLearnCourse } from "@/lib/dashboard-data";

const createdUsers: string[] = [];
const createdCourses: string[] = [];
let teacherId: string;
let databaseVerified = false;

beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_verify")) {
    throw new Error(
      "Integration tests require a disposable DATABASE_URL whose database name ends in _verify.",
    );
  }
  databaseVerified = true;
  const suffix = randomUUID();
  const teacher = await prisma.user.create({
    data: {
      clerkId: `verify-teacher-${suffix}`,
      email: `${suffix}@teacher.example.test`,
      role: "INSTRUCTOR",
    },
  });
  createdUsers.push(teacher.id);
  teacherId = teacher.id;
  const student = await prisma.user.create({
    data: {
      clerkId: `verify-student-${suffix}`,
      email: `${suffix}@student.example.test`,
      role: "STUDENT",
    },
  });
  createdUsers.push(student.id);
  actor.id = student.id;
});

afterAll(async () => {
  if (!databaseVerified) return;
  // Delete only fixtures created by this test run, never reset the database.
  await prisma.learningEvent.deleteMany({
    where: { courseId: { in: createdCourses } },
  });
  await prisma.course.deleteMany({ where: { id: { in: createdCourses } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
  await prisma.$disconnect();
});

async function createCourse(maxAttempts: number | null = 1) {
  const course = await prisma.course.create({
    data: {
      title: "Verification course",
      slug: `verify-${randomUUID()}`,
      instructorId: teacherId,
      status: "PUBLISHED",
      certificatesEnabled: true,
      sections: {
        create: {
          title: "Lessons",
          lessons: {
            create: [
              { title: "First", slug: "first", position: 0 },
              { title: "Second", slug: "second", position: 1 },
            ],
          },
        },
      },
      assessments: {
        create: {
          title: "Final assessment",
          passingScore: 70,
          maxAttempts,
          requiredForCompletion: true,
          questions: {
            create: {
              prompt: "Choose the second option",
              options: ["First", "Second"],
              correctIndex: 1,
            },
          },
        },
      },
      enrollments: { create: { userId: actor.id } },
    },
    include: {
      sections: { include: { lessons: true } },
      assessments: { include: { questions: true } },
    },
  });
  createdCourses.push(course.id);
  return course;
}

function answers(questionId: string) {
  const form = new FormData();
  form.set(`question-${questionId}`, "1");
  return form;
}

describe("Postgres learning transactions", () => {
  it("completes only after all lessons and required assessments, then issues one certificate", async () => {
    const course = await createCourse();
    for (const lesson of course.sections[0].lessons)
      await markLessonCompleteAction(lesson.id);
    const key = { userId_courseId: { userId: actor.id, courseId: course.id } };
    expect(
      (await prisma.enrollment.findUniqueOrThrow({ where: key })).status,
    ).toBe("ACTIVE");
    await expect(issueCertificate(actor.id, course.id)).rejects.toThrow(
      "Required assessments",
    );
    const assessment = course.assessments[0];
    await submitAssessmentAction(
      course.id,
      assessment.id,
      answers(assessment.questions[0].id),
    );
    expect(
      (await prisma.enrollment.findUniqueOrThrow({ where: key })).status,
    ).toBe("COMPLETED");
    const issued = await Promise.all([
      issueCertificate(actor.id, course.id),
      issueCertificate(actor.id, course.id),
    ]);
    expect(issued[0].id).toBe(issued[1].id);
    expect(
      await prisma.certificate.count({
        where: { courseId: course.id, userId: actor.id },
      }),
    ).toBe(1);
  });

  it("allocates only one final attempt when two submissions arrive concurrently", async () => {
    const course = await createCourse(1);
    const assessment = course.assessments[0];
    const results = await Promise.allSettled([
      submitAssessmentAction(
        course.id,
        assessment.id,
        answers(assessment.questions[0].id),
      ),
      submitAssessmentAction(
        course.id,
        assessment.id,
        answers(assessment.questions[0].id),
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const failed = results.find((result) => result.status === "rejected");
    expect(
      failed && failed.status === "rejected" ? failed.reason.message : "",
    ).toContain("used all attempts");
    const attempts = await prisma.assessmentSubmission.findMany({
      where: { assessmentId: assessment.id, userId: actor.id },
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].attemptNumber).toBe(1);
  });

  it("reconciles concurrent final lesson completions without losing course completion", async () => {
    const course = await createCourse();
    const assessment = course.assessments[0];
    await submitAssessmentAction(
      course.id,
      assessment.id,
      answers(assessment.questions[0].id),
    );
    await Promise.all(
      course.sections[0].lessons.map((lesson) =>
        markLessonCompleteAction(lesson.id),
      ),
    );
    expect(
      (
        await prisma.enrollment.findUniqueOrThrow({
          where: { userId_courseId: { userId: actor.id, courseId: course.id } },
        })
      ).status,
    ).toBe("COMPLETED");
  });

  it("denies cancelled enrollment reads and writes while retaining learning history", async () => {
    const course = await createCourse();
    const lesson = course.sections[0].lessons[0];
    await markLessonCompleteAction(lesson.id);
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: actor.id, courseId: course.id } },
      data: { status: "CANCELLED" },
    });
    const student = await prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
    });
    expect((await getLearnCourse(student, course.id)).mode).toBe("permission");
    await expect(markLessonCompleteAction(lesson.id)).rejects.toThrow(
      "enrolled",
    );
    const assessment = course.assessments[0];
    await expect(
      submitAssessmentAction(
        course.id,
        assessment.id,
        answers(assessment.questions[0].id),
      ),
    ).rejects.toThrow("enrolled");
    expect(
      await prisma.lessonProgress.count({
        where: { userId: actor.id, lessonId: lesson.id },
      }),
    ).toBe(1);
  });
});
