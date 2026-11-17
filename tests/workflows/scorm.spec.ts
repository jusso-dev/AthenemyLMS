import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import JSZip from "jszip";

const database = new PrismaClient();
const userIds: string[] = [];
let organizationId = "",
  courseId = "",
  lessonId = "",
  teacherId = "",
  studentId = "";

test.beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL || "invalid:");
  if (
    !url.pathname.endsWith("_verify") ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !process.env.WORKFLOW_RUN_ID
  )
    throw new Error(
      "SCORM workflows require the isolated local verification harness.",
    );
  for (const role of ["INSTRUCTOR", "STUDENT"] as const) {
    const suffix = randomUUID();
    const user = await database.user.create({
      data: {
        clerkId: `workflow-${process.env.WORKFLOW_RUN_ID}-${suffix}`,
        email: `${suffix}@scorm.workflow.test`,
        name: `${role} fixture`,
        role,
      },
    });
    userIds.push(user.id);
  }
  [teacherId, studentId] = userIds;
  const organization = await database.organization.create({
    data: {
      name: "SCORM workflow organization",
      slug: `scorm-workflow-${randomUUID()}`,
      memberships: {
        create: [
          { userId: teacherId, role: "OWNER" },
          { userId: studentId, role: "MEMBER" },
        ],
      },
    },
  });
  organizationId = organization.id;
  const course = await database.course.create({
    data: {
      title: "SCORM workflow course",
      slug: `scorm-course-${randomUUID()}`,
      instructorId: teacherId,
      organizationId,
      status: "PUBLISHED",
      certificatesEnabled: true,
      sections: {
        create: {
          title: "Training",
          lessons: {
            create: {
              title: "SCORM practical lesson",
              slug: "practical",
              position: 0,
            },
          },
        },
      },
      enrollments: { create: { userId: studentId } },
    },
    include: { sections: { include: { lessons: true } } },
  });
  courseId = course.id;
  lessonId = course.sections[0].lessons[0].id;
});

test.afterAll(async () => {
  if (courseId) await database.course.deleteMany({ where: { id: courseId } });
  if (organizationId)
    await database.organization.deleteMany({ where: { id: organizationId } });
  if (userIds.length)
    await database.user.deleteMany({ where: { id: { in: userIds } } });
  await database.$disconnect();
});

test("imports a package, isolates the SCO, saves a checkpoint, resumes, and completes the lesson", async ({
  page,
  context,
}) => {
  const zip = new JSZip();
  zip.file(
    "imsmanifest.xml",
    '<manifest identifier="workflow"><metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata><organizations default="org"><organization identifier="org"><title>Workflow training package</title><item identifierref="launch"/></organization></organizations><resources><resource identifier="launch" href="lesson/index.html"/></resources></manifest>',
  );
  zip.file(
    "lesson/styles.css",
    "body { font: 16px sans-serif; padding: 24px; } button { padding: 12px; margin: 8px; }",
  );
  zip.file(
    "lesson/index.html",
    `<!doctype html><html><head><title>Training fixture</title><link rel="stylesheet" href="styles.css"></head><body>
    <h1>Practice module</h1><p id="bookmark"></p><p id="entry"></p><p id="suspend"></p>
    <button id="save">Save checkpoint</button><button id="finish">Finish lesson</button>
    <script>
      API.LMSInitialize("");
      document.querySelector("#bookmark").textContent = API.LMSGetValue("cmi.core.lesson_location") || "First visit";
      document.querySelector("#entry").textContent = API.LMSGetValue("cmi.core.entry");
      document.querySelector("#suspend").textContent = API.LMSGetValue("cmi.suspend_data");
      document.querySelector("#save").onclick = function () {
        API.LMSSetValue("cmi.core.lesson_status", "incomplete");
        API.LMSSetValue("cmi.core.lesson_location", "Checkpoint two");
        API.LMSSetValue("cmi.suspend_data", "Saved activity answers");
        API.LMSSetValue("cmi.core.session_time", "0000:01:30");
        API.LMSCommit("");
      };
      document.querySelector("#finish").onclick = function () {
        API.LMSSetValue("cmi.core.lesson_status", "passed");
        API.LMSSetValue("cmi.core.score.raw", "90");
        API.LMSSetValue("cmi.core.session_time", "0000:00:30");
        API.LMSFinish("");
      };
    </script></body></html>`,
  );
  await context.addCookies([
    { name: "workflow-user", value: teacherId, url: "http://127.0.0.1:3101" },
  ]);
  await page.goto(`/dashboard/courses/${courseId}/interoperability`);
  await page.getByLabel("Package file").setInputFiles({
    name: "training.zip",
    mimeType: "application/zip",
    buffer: await zip.generateAsync({ type: "nodebuffer" }),
  });
  await page.getByLabel("Attach to lesson").selectOption(lessonId);
  await page
    .getByRole("button", { name: "Import package", exact: true })
    .click();
  await expect(
    page.getByText("SCORM package imported and ready to launch.").first(),
  ).toBeVisible();
  const item = await database.externalPackage.findFirstOrThrow({
    where: { courseId },
  });
  expect(item.storageKey).toBeTruthy();
  await context.addCookies([
    { name: "workflow-user", value: studentId, url: "http://127.0.0.1:3101" },
  ]);
  await page.goto(`/dashboard/learn/${courseId}/lessons/${lessonId}`);
  await expect(
    page.getByRole("button", { name: "Mark complete", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Workflow training package", exact: true })
    .click();
  const contentResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/scorm/content/${item.id}/`) &&
      response.url().endsWith("/lesson/index.html"),
  );
  await page
    .getByRole("button", { name: "Start package", exact: true })
    .click();
  const response = await contentResponse;
  expect(response.status()).toBe(200);
  expect(response.headers()["content-security-policy"]).toContain(
    "sandbox allow-scripts;",
  );
  expect(response.headers()["cache-control"]).toContain("no-store");
  await expect(
    page.locator('iframe[title="SCORM course content"]'),
  ).toHaveAttribute("sandbox", "allow-scripts");
  const frame = page.frameLocator('iframe[title="SCORM course content"]');
  await expect(frame.getByText("First visit", { exact: true })).toBeVisible();
  await frame.getByRole("button", { name: "Save checkpoint" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Progress saved" }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        (
          await database.externalPackageAttempt.findUniqueOrThrow({
            where: {
              packageId_userId: { packageId: item.id, userId: studentId },
            },
          })
        ).totalTimeSeconds,
    )
    .toBe(90);
  await page.reload();
  await page
    .getByRole("button", { name: "Start package", exact: true })
    .click();
  await expect(
    frame.getByText("Checkpoint two", { exact: true }),
  ).toBeVisible();
  await expect(frame.getByText("resume", { exact: true })).toBeVisible();
  await expect(
    frame.getByText("Saved activity answers", { exact: true }),
  ).toBeVisible();
  await frame.getByRole("button", { name: "Finish lesson" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Progress saved. You can return to your course." }),
  ).toBeVisible();
  const attempt = await database.externalPackageAttempt.findUniqueOrThrow({
    where: { packageId_userId: { packageId: item.id, userId: studentId } },
  });
  expect(attempt.completionStatus).toBe("passed");
  expect(attempt.scoreRaw).toBe(90);
  expect(attempt.totalTimeSeconds).toBe(120);
  expect(
    (
      await database.enrollment.findUniqueOrThrow({
        where: { userId_courseId: { userId: studentId, courseId } },
      })
    ).status,
  ).toBe("COMPLETED");
  expect(
    (
      await database.lessonProgress.findUniqueOrThrow({
        where: { userId_lessonId: { userId: studentId, lessonId } },
      })
    ).completedAt,
  ).not.toBeNull();
});
