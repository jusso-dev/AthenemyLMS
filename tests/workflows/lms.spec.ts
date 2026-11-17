import { test, expect, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
const db = new PrismaClient();
const prefix = `workflow-${process.env.WORKFLOW_RUN_ID}`;
let teacherId: string, studentId: string, orgId: string;
async function actor(context: BrowserContext, id: string) {
  await context.addCookies([
    {
      name: "workflow-user",
      value: id,
      url: "http://127.0.0.1:3101",
      httpOnly: true,
    },
  ]);
}
test.beforeAll(async () => {
  if (
    !process.env.DATABASE_URL ||
    !new URL(process.env.DATABASE_URL).pathname.endsWith("_verify")
  )
    throw new Error("Disposable _verify database required");
  const teacher = await db.user.create({
    data: {
      clerkId: `${prefix}-teacher`,
      email: `${prefix}-teacher@example.test`,
      name: "Workflow Teacher",
      role: "INSTRUCTOR",
    },
  });
  teacherId = teacher.id;
  const student = await db.user.create({
    data: {
      clerkId: `${prefix}-learner`,
      email: `${prefix}-learner@example.test`,
      name: "Workflow Learner",
    },
  });
  studentId = student.id;
  const org = await db.organization.create({
    data: {
      name: "Workflow academy",
      slug: prefix,
      memberships: {
        create: [
          { userId: teacherId, role: "OWNER" },
          { userId: studentId, role: "MEMBER" },
        ],
      },
    },
  });
  orgId = org.id;
});
test.afterAll(async () => {
  if (teacherId)
    await db.learningEvent.deleteMany({
      where: { course: { instructorId: teacherId } },
    });
  if (teacherId)
    await db.course.deleteMany({ where: { instructorId: teacherId } });
  if (orgId) await db.organization.delete({ where: { id: orgId } });
  await db.user.deleteMany({
    where: { id: { in: [teacherId, studentId].filter(Boolean) } },
  });
  await db.$disconnect();
});

test("instructor authors and publishes, learner enrolls, completes timed assessment and earns certificate", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  await actor(context, teacherId);
  await page.goto("/dashboard/courses/new");
  await page
    .getByLabel("Title", { exact: true })
    .fill("Workflow learning journey");
  await page
    .getByLabel("Slug", { exact: true })
    .fill(`journey-${randomUUID()}`);
  await page.getByRole("button", { name: "Save course" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  const courseId = page.url().split("/courses/")[1].split("/")[0];
  await page.goto(`/dashboard/courses/${courseId}/curriculum`);
  await page.getByPlaceholder("Section title").fill("First steps");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByPlaceholder("Lesson title")).toBeVisible();
  await page.getByPlaceholder("Lesson title").fill("Welcome lesson");
  await page.getByPlaceholder("Minutes", { exact: true }).fill("5");
  await page
    .getByPlaceholder("Lesson notes")
    .fill("Learn, practice, and complete the assessment.");
  await page.getByRole("button", { name: "Lesson", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Edit lesson", exact: true }),
  ).toBeVisible();
  await page.goto(`/dashboard/courses/${courseId}/assessments`);
  await page.getByPlaceholder("Quiz title").fill("Final knowledge check");
  await page
    .getByPlaceholder("Question prompt")
    .fill("Which option completes this course?");
  await page
    .getByPlaceholder("Answer options, one per line")
    .fill("First option\nSecond option");
  await page.getByPlaceholder("Correct option index").fill("1");
  await page.getByPlaceholder("Attempt limit").fill("2");
  await page.getByLabel("Time limit in minutes").fill("10");
  await page.getByLabel("Require passing this quiz for completion").check();
  await page.getByRole("button", { name: "Create quiz" }).click();
  await expect(
    page.getByRole("link", { name: "Manage", exact: true }),
  ).toBeVisible();
  await page.goto(`/dashboard/courses/${courseId}/edit`);
  await page.getByLabel("Status", { exact: true }).selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Save course" }).click();
  await expect
    .poll(
      async () =>
        (await db.course.findUniqueOrThrow({ where: { id: courseId } })).status,
    )
    .toBe("PUBLISHED");
  const course = await db.course.findUniqueOrThrow({
    where: { id: courseId },
    include: { sections: { include: { lessons: true } }, assessments: true },
  });
  await actor(context, studentId);
  const enroll = await page.request.post("/api/stripe/checkout", {
    data: { courseId },
  });
  expect(enroll.status()).toBe(200);
  await page.goto(`/dashboard/learn/${courseId}/certificate`);
  await expect(
    page.getByRole("button", { name: "Issue certificate" }),
  ).toBeDisabled();
  await page.goto(
    `/dashboard/learn/${courseId}/lessons/${course.sections[0].lessons[0].id}`,
  );
  await page
    .getByRole("button", { name: "Mark complete", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Completed", exact: true }),
  ).toBeVisible();
  await page.goto(
    `/dashboard/learn/${courseId}/assessments/${course.assessments[0].id}`,
  );
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(
    page.getByRole("timer", { name: "Time remaining" }),
  ).toBeVisible();
  const attempt = await db.assessmentAttempt.findFirstOrThrow({
    where: { assessmentId: course.assessments[0].id, userId: studentId },
  });
  await page.reload();
  await expect(
    page.getByRole("timer", { name: "Time remaining" }),
  ).toBeVisible();
  expect(
    await db.assessmentAttempt.count({
      where: { assessmentId: course.assessments[0].id, userId: studentId },
    }),
  ).toBe(1);
  await page.getByLabel("Second option").check();
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await expect(page.getByText("Latest score: 100% · Passed")).toBeVisible();
  expect(
    (
      await db.assessmentAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      })
    ).submittedAt,
  ).not.toBeNull();
  await page.goto(`/dashboard/learn/${courseId}/certificate`);
  await page.getByRole("button", { name: "Issue certificate" }).click();
  await expect(page).toHaveURL(/\/certificates\/ATH-/);
  await expect(
    page.getByRole("heading", { name: "Certificate verified" }),
  ).toBeVisible();
  const certificateNumber = page.url().split("/certificates/")[1];
  expect(
    await db.certificate.findUnique({ where: { certificateNumber } }),
  ).toMatchObject({ userId: studentId, courseId });
  const pdf = await page.request.get(`/certificates/${certificateNumber}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  const events = await db.learningEvent.findMany({
    where: { courseId },
    select: { type: true },
  });
  expect(events.map((e) => e.type)).toEqual(
    expect.arrayContaining([
      "user.enrolled",
      "assessment.passed",
      "course.completed",
      "certificate.issued",
    ]),
  );
});

test("expired attempts consume the limit and cancelled learners cannot read lessons", async ({
  page,
  context,
}) => {
  const course = await db.course.create({
    data: {
      title: "Expiry and revoked access",
      slug: `workflow-${randomUUID()}`,
      instructorId: teacherId,
      organizationId: orgId,
      status: "PUBLISHED",
      sections: {
        create: {
          title: "Lessons",
          lessons: { create: { title: "Private lesson", slug: "private" } },
        },
      },
      enrollments: { create: { userId: studentId } },
    },
    include: { sections: { include: { lessons: true } } },
  });
  const assessment = await db.assessment.create({
    data: {
      courseId: course.id,
      title: "Timed quiz",
      maxAttempts: 1,
      timeLimitMinutes: 1,
      questions: {
        create: {
          prompt: "Select the right answer",
          options: ["Yes", "No"],
          correctIndex: 0,
        },
      },
    },
  });
  await actor(context, studentId);
  await page.goto(`/dashboard/learn/${course.id}/assessments/${assessment.id}`);
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await db.assessmentAttempt.updateMany({
    where: { assessmentId: assessment.id },
    data: { deadlineAt: new Date(Date.now() - 1000) },
  });
  await page.reload();
  await expect(page.getByText("Latest score: 0% · Not passed")).toBeVisible({
    timeout: 15000,
  });
  expect(
    await db.assessmentSubmission.count({
      where: { assessmentId: assessment.id },
    }),
  ).toBe(1);
  await db.enrollment.update({
    where: { userId_courseId: { userId: studentId, courseId: course.id } },
    data: { status: "CANCELLED" },
  });
  await page.goto(
    `/dashboard/learn/${course.id}/lessons/${course.sections[0].lessons[0].id}`,
  );
  await expect(
    page.getByText("Enroll in this course to access lessons."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark complete" })).toHaveCount(
    0,
  );
});
