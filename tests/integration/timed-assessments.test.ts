import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const actor = vi.hoisted(() => ({
  id: "",
  role: "STUDENT" as const,
  email: "timed@example.test",
  name: "Timed learner",
}));
vi.mock("@/lib/auth", () => ({ requireAppUser: async () => actor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { prisma } from "@/lib/prisma";
import {
  startAssessmentAction,
  submitAssessmentAction,
} from "@/app/dashboard/courses/actions";
import { canShowAssessmentFeedback } from "@/lib/assessments";
const users: string[] = [],
  courses: string[] = [],
  organizations: string[] = [];
let teacherId: string, organizationId: string;
let databaseVerified = false;
beforeAll(async () => {
  if (
    !process.env.DATABASE_URL ||
    !new URL(process.env.DATABASE_URL).pathname.endsWith("_verify")
  )
    throw new Error("Timed tests require a disposable _verify database.");
  databaseVerified = true;
  for (const role of ["INSTRUCTOR", "STUDENT"] as const) {
    const token = randomUUID();
    const user = await prisma.user.create({
      data: { clerkId: `timed-${token}`, email: `${token}@example.test`, role },
    });
    users.push(user.id);
    if (role === "INSTRUCTOR") teacherId = user.id;
    else actor.id = user.id;
  }
  const org = await prisma.organization.create({
    data: { name: "Timed verification", slug: `timed-${randomUUID()}` },
  });
  organizationId = org.id;
  organizations.push(org.id);
});
afterAll(async () => {
  if (!databaseVerified) return;
  await prisma.learningEvent.deleteMany({ where: { courseId: { in: courses } } });
  await prisma.course.deleteMany({ where: { id: { in: courses } } });
  await prisma.organization.deleteMany({
    where: { id: { in: organizations } },
  });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});
async function fixture(maxAttempts = 1, closesAt?: Date) {
  const course = await prisma.course.create({
    data: {
      title: "Timed verification",
      slug: `timed-${randomUUID()}`,
      instructorId: teacherId,
      organizationId,
      status: "PUBLISHED",
      enrollments: { create: { userId: actor.id } },
      assessments: {
        create: {
          title: "Timed quiz",
          maxAttempts,
          timeLimitMinutes: 1,
          closesAt,
          requiredForCompletion: true,
          questions: {
            create: {
              prompt: "Choose correct",
              options: ["Correct", "Wrong"],
              correctIndex: 0,
            },
          },
        },
      },
    },
    include: { assessments: { include: { questions: true } } },
  });
  courses.push(course.id);
  return { course, assessment: course.assessments[0] };
}
function answers(attemptId: string, questionId: string) {
  const form = new FormData();
  form.set("attemptId", attemptId);
  form.set(`question-${questionId}`, "0");
  return form;
}
describe("persisted timed assessment attempts", () => {
  it("resumes concurrent starts, grades duplicate submissions once and writes one result event", async () => {
    const { course, assessment } = await fixture();
    const [first, second] = await Promise.all([
      startAssessmentAction(course.id, assessment.id),
      startAssessmentAction(course.id, assessment.id),
    ]);
    expect(first.id).toBe(second.id);
    const stored = await prisma.assessmentAttempt.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(stored.deadlineAt!.getTime() - stored.startedAt.getTime()).toBe(
      60_000,
    );
    await Promise.all([
      submitAssessmentAction(
        course.id,
        assessment.id,
        answers(first.id, assessment.questions[0].id),
      ),
      submitAssessmentAction(
        course.id,
        assessment.id,
        answers(first.id, assessment.questions[0].id),
      ),
    ]);
    const submissions = await prisma.assessmentSubmission.findMany({
      where: { assessmentId: assessment.id },
    });
    expect(submissions).toHaveLength(1);
    expect(submissions[0].score).toBe(100);
    expect(
      await prisma.learningEvent.count({
        where: { courseId: course.id, type: "assessment.passed" },
      }),
    ).toBe(1);
    await expect(
      startAssessmentAction(course.id, assessment.id),
    ).rejects.toThrow("all attempts");
  });
  it("uses the stored deadline despite a forged client timestamp and consumes an expired attempt", async () => {
    const { course, assessment } = await fixture();
    const attempt = await startAssessmentAction(course.id, assessment.id);
    await prisma.assessmentAttempt.update({
      where: { id: attempt.id },
      data: { deadlineAt: new Date(Date.now() - 1000) },
    });
    expect((await startAssessmentAction(course.id, assessment.id)).id).toBe(
      attempt.id,
    );
    const form = answers(attempt.id, assessment.questions[0].id);
    form.set("deadlineAt", "2099-01-01T00:00:00Z");
    await submitAssessmentAction(course.id, assessment.id, form);
    await submitAssessmentAction(course.id, assessment.id, form);
    const result = await prisma.assessmentSubmission.findUniqueOrThrow({
      where: { attemptId: attempt.id },
    });
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.answers).toEqual({});
    await expect(
      startAssessmentAction(course.id, assessment.id),
    ).rejects.toThrow("all attempts");
  });
  it("rejects submissions without a start or with another learner's attempt", async () => {
    const { course, assessment } = await fixture();
    await expect(
      submitAssessmentAction(course.id, assessment.id, new FormData()),
    ).rejects.toThrow("Start this assessment");
    const attempt = await startAssessmentAction(course.id, assessment.id);
    await prisma.assessmentAttempt.update({
      where: { id: attempt.id },
      data: { userId: teacherId },
    });
    await expect(
      submitAssessmentAction(
        course.id,
        assessment.id,
        answers(attempt.id, assessment.questions[0].id),
      ),
    ).rejects.toThrow("not found");
    expect(
      await prisma.assessmentSubmission.count({
        where: { assessmentId: assessment.id },
      }),
    ).toBe(0);
  });
  it("enforces revoked access on resume and submission", async () => {
    const { course, assessment } = await fixture();
    const attempt = await startAssessmentAction(course.id, assessment.id);
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: actor.id, courseId: course.id } },
      data: { status: "CANCELLED" },
    });
    await expect(
      startAssessmentAction(course.id, assessment.id),
    ).rejects.toThrow("enrolled");
    await expect(
      submitAssessmentAction(
        course.id,
        assessment.id,
        answers(attempt.id, assessment.questions[0].id),
      ),
    ).rejects.toThrow("enrolled");
  });
  it("caps the deadline at close, rejects starts after close, and gates scheduled results", async () => {
    const closesAt = new Date(Date.now() + 30_000);
    const { course, assessment } = await fixture(2, closesAt);
    await prisma.assessment.update({
      where: { id: assessment.id },
      data: { feedbackMode: "AFTER_CLOSE" },
    });
    const attempt = await startAssessmentAction(course.id, assessment.id);
    expect(
      (
        await prisma.assessmentAttempt.findUniqueOrThrow({
          where: { id: attempt.id },
        })
      ).deadlineAt,
    ).toEqual(closesAt);
    await submitAssessmentAction(
      course.id,
      assessment.id,
      answers(attempt.id, assessment.questions[0].id),
    );
    expect(
      canShowAssessmentFeedback(
        "AFTER_CLOSE",
        true,
        closesAt,
        new Date(closesAt.getTime() - 1),
      ),
    ).toBe(false);
    expect(
      canShowAssessmentFeedback("AFTER_CLOSE", true, closesAt, closesAt),
    ).toBe(true);
    await prisma.assessment.update({
      where: { id: assessment.id },
      data: { closesAt: new Date(Date.now() - 1000) },
    });
    await expect(
      startAssessmentAction(course.id, assessment.id),
    ).rejects.toThrow("closed");
  });
});
