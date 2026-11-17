import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const actor = vi.hoisted(() => ({
  id: "",
  role: "INSTRUCTOR" as "INSTRUCTOR" | "STUDENT",
  organizationMemberships: [],
}));
vi.mock("@/lib/auth", () => ({
  requireAppUser: async () => actor,
  getCurrentAppUser: async () => actor,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { uploadScormPackageAction } from "@/app/dashboard/courses/scorm-actions";
import { markLessonCompleteAction } from "@/app/dashboard/courses/actions";
import {
  commitScormProgress,
  createScormSession,
  getScormContentSession,
} from "@/lib/scorm-runtime";
import { getCertificateEligibility } from "@/lib/certificates";
import { getLearningCompletion } from "@/lib/learning";
import { getLearnCourse, getMyCourses } from "@/lib/dashboard-data";

const users: string[] = [],
  courses: string[] = [];
let teacherId = "",
  studentId = "",
  otherId = "",
  directory = "";
beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_verify"))
    throw new Error(
      "SCORM integration tests require a disposable _verify database.",
    );
  directory = await mkdtemp(path.join(os.tmpdir(), "scorm-integration-"));
  vi.stubEnv("SCORM_STORAGE_DIR", directory);
  for (const role of ["INSTRUCTOR", "STUDENT", "STUDENT"] as const) {
    const id = randomUUID();
    const user = await prisma.user.create({
      data: { clerkId: `scorm-${id}`, email: `${id}@scorm.example.test`, role },
    });
    users.push(user.id);
  }
  [teacherId, studentId, otherId] = users;
});
afterAll(async () => {
  if (courses.length)
    await prisma.learningEvent.deleteMany({
      where: { courseId: { in: courses } },
    });
  if (courses.length)
    await prisma.course.deleteMany({ where: { id: { in: courses } } });
  if (users.length)
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  if (directory) await rm(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});

async function fixture(requiredAssessment = false) {
  const course = await prisma.course.create({
    data: {
      title: "SCORM verification",
      slug: `scorm-${randomUUID()}`,
      instructorId: teacherId,
      status: "PUBLISHED",
      certificatesEnabled: true,
      sections: {
        create: {
          title: "Training",
          lessons: {
            create: {
              title: "SCORM lesson",
              slug: "scorm-lesson",
              position: 0,
            },
          },
        },
      },
      enrollments: { create: { userId: studentId } },
      ...(requiredAssessment
        ? {
            assessments: {
              create: { title: "Required quiz", requiredForCompletion: true },
            },
          }
        : {}),
    },
    include: { sections: { include: { lessons: true } } },
  });
  courses.push(course.id);
  const lessonId = course.sections[0].lessons[0].id;
  const zip = new JSZip();
  zip.file(
    "imsmanifest.xml",
    '<manifest identifier="demo"><metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata><organizations default="org"><organization identifier="org"><title>Runtime fixture</title><item identifierref="launch"/></organization></organizations><resources><resource identifier="launch" href="index.html"/></resources></manifest>',
  );
  zip.file(
    "index.html",
    "<!doctype html><html><head><title>Runtime fixture</title></head><body><h1>SCORM fixture</h1></body></html>",
  );
  const form = new FormData();
  form.set("lessonId", lessonId);
  form.set(
    "packageFile",
    new File(
      [
        (await zip.generateAsync({
          type: "uint8array",
        })) as Uint8Array<ArrayBuffer>,
      ],
      "training.zip",
      { type: "application/zip" },
    ),
  );
  actor.id = teacherId;
  actor.role = "INSTRUCTOR";
  await uploadScormPackageAction(course.id, form);
  const item = await prisma.externalPackage.findFirstOrThrow({
    where: { courseId: course.id },
  });
  actor.id = studentId;
  actor.role = "STUDENT";
  return { course, lessonId, item };
}

describe("SCORM import and runtime in PostgreSQL", () => {
  it("keeps historical progress but shows unfinished required packages in learner views", async () => {
    const { course, lessonId, item } = await fixture();
    await prisma.lessonProgress.create({
      data: { userId: studentId, lessonId, completedAt: new Date() },
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: studentId },
    });
    expect((await getLearnCourse(user, course.id)).completedLessonIds).toEqual(
      [],
    );
    const courses = await getMyCourses(user);
    expect(
      courses.courses.find((row) => row.course.id === course.id),
    ).toMatchObject({
      complete: false,
      completedLessons: 0,
      nextLesson: { id: lessonId },
    });
    expect(
      await prisma.lessonProgress.count({
        where: { userId: studentId, lessonId, completedAt: { not: null } },
      }),
    ).toBe(1);
    const launch = await createScormSession(item.id, studentId);
    await commitScormProgress(studentId, {
      sessionId: launch.sessionId,
      sequence: 1,
      cmi: { "cmi.core.lesson_status": "passed" },
    });
    expect((await getLearnCourse(user, course.id)).completedLessonIds).toEqual([
      lessonId,
    ]);
  });

  it("imports private files, resumes CMI, makes repeated commits idempotent, and completes the lesson", async () => {
    const { course, lessonId, item } = await fixture();
    expect(item.status).toBe("READY");
    await expect(markLessonCompleteAction(lessonId)).rejects.toThrow("SCORM");
    const launch = await createScormSession(item.id, studentId);
    const before = await getScormContentSession(item.id, launch.token);
    expect(before.cmi["cmi.core.entry"]).toBe("ab-initio");
    const payload = {
      sessionId: launch.sessionId,
      sequence: 1,
      cmi: {
        "cmi.core.lesson_status": "incomplete",
        "cmi.core.lesson_location": "slide-2",
        "cmi.suspend_data": '{"slide":2}',
        "cmi.core.session_time": "0000:01:30",
        "cmi.core.score.raw": "75",
      },
    };
    await commitScormProgress(studentId, payload);
    await commitScormProgress(studentId, payload);
    let attempt = await prisma.externalPackageAttempt.findUniqueOrThrow({
      where: { packageId_userId: { packageId: item.id, userId: studentId } },
    });
    expect(attempt.totalTimeSeconds).toBe(90);
    const resumed = await createScormSession(item.id, studentId);
    const content = await getScormContentSession(item.id, resumed.token);
    expect(content.cmi["cmi.core.lesson_location"]).toBe("slide-2");
    expect(content.cmi["cmi.suspend_data"]).toBe('{"slide":2}');
    expect(content.cmi["cmi.core.session_time"]).toBe("0000:00:00");
    await expect(
      commitScormProgress(studentId, { ...payload, sequence: 2 }),
    ).rejects.toThrow("expired");
    await expect(getScormContentSession(item.id, launch.token)).rejects.toThrow(
      "expired",
    );
    await commitScormProgress(studentId, {
      sessionId: resumed.sessionId,
      sequence: 1,
      cmi: {
        "cmi.core.lesson_status": "passed",
        "cmi.core.session_time": "0000:00:30",
        "cmi.core.score.raw": "90",
      },
      finish: true,
    });
    attempt = await prisma.externalPackageAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    expect(attempt.totalTimeSeconds).toBe(120);
    expect(attempt.scoreScaled).toBe(0.9);
    expect(
      (
        await prisma.lessonProgress.findUniqueOrThrow({
          where: { userId_lessonId: { userId: studentId, lessonId } },
        })
      ).completedAt,
    ).not.toBeNull();
    expect(
      (
        await prisma.enrollment.findUniqueOrThrow({
          where: {
            userId_courseId: { userId: studentId, courseId: course.id },
          },
        })
      ).status,
    ).toBe("COMPLETED");
    expect(
      (await getCertificateEligibility(studentId, course.id)).eligible,
    ).toBe(true);
  });
  it("keeps required assessments and all package requirements in the completion gate", async () => {
    const { course, lessonId, item } = await fixture(true);
    await prisma.lessonProgress.create({
      data: { userId: studentId, lessonId, completedAt: new Date() },
    });
    expect(
      (await getLearningCompletion(studentId, course.id)).missingScorm,
    ).toHaveLength(1);
    const launch = await createScormSession(item.id, studentId);
    await commitScormProgress(studentId, {
      sessionId: launch.sessionId,
      sequence: 1,
      cmi: { "cmi.core.lesson_status": "completed" },
    });
    expect((await getLearningCompletion(studentId, course.id)).complete).toBe(
      false,
    );
    expect(
      (await getCertificateEligibility(studentId, course.id)).eligible,
    ).toBe(false);
    expect(
      (
        await prisma.enrollment.findUniqueOrThrow({
          where: {
            userId_courseId: { userId: studentId, courseId: course.id },
          },
        })
      ).status,
    ).toBe("ACTIVE");
  });
  it("rejects another learner and revokes existing content and commit access when enrolment is cancelled", async () => {
    const { course, item } = await fixture();
    await expect(createScormSession(item.id, otherId)).rejects.toThrow(
      "access",
    );
    const launch = await createScormSession(item.id, studentId);
    await expect(
      commitScormProgress(otherId, {
        sessionId: launch.sessionId,
        sequence: 1,
        cmi: {},
      }),
    ).rejects.toThrow("expired");
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: studentId, courseId: course.id } },
      data: { status: "CANCELLED" },
    });
    await expect(getScormContentSession(item.id, launch.token)).rejects.toThrow(
      "access",
    );
    await expect(
      commitScormProgress(studentId, {
        sessionId: launch.sessionId,
        sequence: 1,
        cmi: { "cmi.core.lesson_status": "completed" },
      }),
    ).rejects.toThrow("access");
    expect(
      await prisma.lessonProgress.count({
        where: {
          userId: studentId,
          lesson: { section: { courseId: course.id } },
        },
      }),
    ).toBe(0);
  });
  it("manager previews do not create enrolments or lesson progress", async () => {
    const { item, course } = await fixture();
    const launch = await createScormSession(item.id, teacherId);
    await commitScormProgress(teacherId, {
      sessionId: launch.sessionId,
      sequence: 1,
      cmi: { "cmi.core.lesson_status": "completed" },
    });
    expect(
      await prisma.enrollment.count({
        where: { userId: teacherId, courseId: course.id },
      }),
    ).toBe(0);
    expect(
      await prisma.lessonProgress.count({
        where: {
          userId: teacherId,
          lesson: { section: { courseId: course.id } },
        },
      }),
    ).toBe(0);
  });
  it("requires every lesson package and withdraws completion when saved status becomes incomplete", async () => {
    const { course, lessonId, item } = await fixture();
    const second = await prisma.externalPackage.create({
      data: {
        courseId: course.id,
        lessonId,
        uploadedById: teacherId,
        type: "SCORM_12",
        status: "READY",
        title: "Second SCO",
        launchPath: item.launchPath,
        storageKey: item.storageKey,
      },
    });
    const firstLaunch = await createScormSession(item.id, studentId);
    await commitScormProgress(studentId, {
      sessionId: firstLaunch.sessionId,
      sequence: 1,
      cmi: {
        "cmi.core.lesson_status": "passed",
        "cmi.core.score.raw": "90",
        "cmi.core.session_time": "0000:00:15",
      },
    });
    expect(
      await prisma.lessonProgress.count({
        where: { userId: studentId, lessonId, completedAt: { not: null } },
      }),
    ).toBe(0);
    const secondLaunch = await createScormSession(second.id, studentId);
    await commitScormProgress(studentId, {
      sessionId: secondLaunch.sessionId,
      sequence: 1,
      cmi: { "cmi.core.lesson_status": "completed" },
    });
    expect((await getLearningCompletion(studentId, course.id)).complete).toBe(
      true,
    );
    const resumed = await createScormSession(item.id, studentId);
    await commitScormProgress(studentId, {
      sessionId: resumed.sessionId,
      sequence: 1,
      cmi: { "cmi.core.lesson_status": "incomplete", "cmi.core.score.raw": "" },
    });
    const attempt = await prisma.externalPackageAttempt.findUniqueOrThrow({
      where: { packageId_userId: { packageId: item.id, userId: studentId } },
    });
    expect(attempt.totalTimeSeconds).toBe(15);
    expect(attempt.scoreRaw).toBeNull();
    expect((await getLearningCompletion(studentId, course.id)).complete).toBe(
      false,
    );
    expect(
      (
        await prisma.lessonProgress.findUniqueOrThrow({
          where: { userId_lessonId: { userId: studentId, lessonId } },
        })
      ).completedAt,
    ).toBeNull();
    expect(
      (
        await prisma.enrollment.findUniqueOrThrow({
          where: {
            userId_courseId: { userId: studentId, courseId: course.id },
          },
        })
      ).status,
    ).toBe("ACTIVE");
  });

  it("expires content and save capabilities and allows a fresh authorized launch", async () => {
    const { item } = await fixture();
    const launch = await createScormSession(item.id, studentId);
    await prisma.externalPackageSession.update({
      where: { id: launch.sessionId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(getScormContentSession(item.id, launch.token)).rejects.toThrow(
      "expired",
    );
    await expect(
      commitScormProgress(studentId, {
        sessionId: launch.sessionId,
        sequence: 1,
        cmi: {},
      }),
    ).rejects.toThrow("expired");
    const fresh = await createScormSession(item.id, studentId);
    expect(
      (await getScormContentSession(item.id, fresh.token)).session.id,
    ).toBe(fresh.sessionId);
    expect(
      await prisma.externalPackageSession.findUnique({
        where: { id: launch.sessionId },
      }),
    ).toBeNull();
  });
});
