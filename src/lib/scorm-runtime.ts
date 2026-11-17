import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordCourseEvent } from "@/lib/learning-events";
import { canManageCourse, resolvePlatformRole } from "@/lib/permissions";
import {
  hasLearningAccess,
  learningTransaction,
  reconcileLearningCompletion,
} from "@/lib/learning";
import {
  resumeScormCmi,
  scormCmiSchema,
  scormCommitSchema,
  scormTimeSeconds,
  scormTimeString,
} from "@/lib/scorm-cmi";

export class ScormAccessError extends Error {}
export const hashScormToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function authorizeScormPackage(
  database: Prisma.TransactionClient,
  packageId: string,
  userId: string,
) {
  const [item, user, enrollment] = await Promise.all([
    database.externalPackage.findUnique({
      where: { id: packageId },
      include: { course: true },
    }),
    database.user.findUnique({
      where: { id: userId },
      include: { organizationMemberships: true },
    }),
    database.enrollment.findFirst({
      where: {
        userId,
        course: { externalPackages: { some: { id: packageId } } },
      },
    }),
  ]);
  if (
    !item ||
    !user ||
    item.status !== "READY" ||
    item.type !== "SCORM_12" ||
    !item.storageKey ||
    !item.launchPath
  )
    throw new ScormAccessError(
      "This package is not available. Ask the instructor to import it again.",
    );
  const actor = {
    ...user,
    role: resolvePlatformRole(
      user.role,
      user.clerkId,
      process.env.PLATFORM_ADMIN_CLERK_IDS,
    ),
  };
  const manager = canManageCourse(actor, item.course);
  if (!manager && !hasLearningAccess(enrollment))
    throw new ScormAccessError("You no longer have access to this package.");
  return { item, user, enrollment, manager };
}

export async function createScormSession(packageId: string, userId: string) {
  const token = randomBytes(32).toString("hex");
  return learningTransaction(async (database) => {
    const { item } = await authorizeScormPackage(database, packageId, userId);
    const attempt = await database.externalPackageAttempt.upsert({
      where: { packageId_userId: { packageId, userId } },
      create: {
        packageId,
        userId,
        courseId: item.courseId,
        lessonId: item.lessonId,
        completionStatus: "not attempted",
      },
      update: {},
    });
    const session = await database.externalPackageSession.create({
      data: {
        attemptId: attempt.id,
        tokenHash: hashScormToken(token),
        expiresAt: new Date(Date.now() + 8 * 3600 * 1000),
      },
    });
    await database.externalPackageAttempt.update({
      where: { id: attempt.id },
      data: { runtimeSessionId: session.id },
    });
    // Expired tokens are never valid; prune this learner's old session metadata opportunistically.
    await database.externalPackageSession.deleteMany({
      where: { attemptId: attempt.id, expiresAt: { lt: new Date() } },
    });
    return {
      sessionId: session.id,
      token,
      launchPath: item.launchPath!,
      title: item.title,
    };
  });
}

export async function getScormContentSession(packageId: string, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new ScormAccessError("Package not found.");
  const session = await prisma.externalPackageSession.findUnique({
    where: { tokenHash: hashScormToken(token) },
    include: { attempt: true },
  });
  if (
    !session ||
    session.expiresAt <= new Date() ||
    session.attempt.packageId !== packageId ||
    session.attempt.runtimeSessionId !== session.id
  )
    throw new ScormAccessError(
      "This launch session has expired. Reload the player.",
    );
  const access = await authorizeScormPackage(
    prisma,
    packageId,
    session.attempt.userId,
  );
  const resumed = resumeScormCmi(session.attempt.lastStatement);
  return {
    ...access,
    session,
    cmi: {
      ...resumed,
      "cmi.core.lesson_status":
        resumed["cmi.core.lesson_status"] || "not attempted",
      "cmi.core.lesson_location": resumed["cmi.core.lesson_location"] || "",
      "cmi.suspend_data": resumed["cmi.suspend_data"] || "",
      "cmi.core.score.raw": resumed["cmi.core.score.raw"] || "",
      "cmi.core.score.min": resumed["cmi.core.score.min"] || "0",
      "cmi.core.score.max": resumed["cmi.core.score.max"] || "100",
      "cmi.core.session_time": scormTimeString(session.sessionTimeSeconds),
      "cmi.core.exit": "",
      "cmi.core.entry": Object.keys(resumed).length ? "resume" : "ab-initio",
      "cmi.core.credit": "credit",
      "cmi.core.lesson_mode": "normal",
      "cmi.core.student_id": access.user.id,
      "cmi.core.student_name": access.user.name || "Learner",
      "cmi.core.total_time": scormTimeString(
        session.attempt.totalTimeSeconds - session.sessionTimeSeconds,
      ),
      "cmi.core._children":
        "student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time",
      "cmi.core.score._children": "raw,min,max",
    },
  };
}

export async function commitScormProgress(userId: string, input: unknown) {
  const payload = scormCommitSchema.parse(input);
  return learningTransaction(async (database) => {
    const session = await database.externalPackageSession.findUnique({
      where: { id: payload.sessionId },
      include: { attempt: true },
    });
    if (
      !session ||
      session.attempt.userId !== userId ||
      session.expiresAt <= new Date() ||
      session.attempt.runtimeSessionId !== session.id
    )
      throw new ScormAccessError(
        "This launch session has expired. Reload the player.",
      );
    const { item, enrollment } = await authorizeScormPackage(
      database,
      session.attempt.packageId,
      userId,
    );
    if (payload.sequence <= session.sequence)
      return { saved: true, sequence: session.sequence };
    const cmi = scormCmiSchema.parse({
      ...resumeScormCmi(session.attempt.lastStatement),
      "cmi.core.session_time": scormTimeString(session.sessionTimeSeconds),
      ...payload.cmi,
    });
    const seconds = cmi["cmi.core.session_time"]
      ? scormTimeSeconds(cmi["cmi.core.session_time"])
      : session.sessionTimeSeconds;
    const time = Math.max(seconds, session.sessionTimeSeconds);
    const status =
      cmi["cmi.core.lesson_status"] || session.attempt.completionStatus;
    const score = cmi["cmi.core.score.raw"];
    const min = Number(cmi["cmi.core.score.min"] || "0"),
      max = Number(cmi["cmi.core.score.max"] || "100");
    await database.externalPackageSession.update({
      where: { id: session.id },
      data: { sequence: payload.sequence, sessionTimeSeconds: time },
    });
    await database.externalPackageAttempt.update({
      where: { id: session.attempt.id },
      data: {
        completionStatus: status,
        successStatus:
          status === "passed"
            ? "passed"
            : status === "failed"
              ? "failed"
              : "unknown",
        ...(score !== undefined
          ? {
              scoreRaw: score ? Number(score) : null,
              scoreScaled:
                score && max > min ? (Number(score) - min) / (max - min) : null,
            }
          : {}),
        totalTimeSeconds: { increment: time - session.sessionTimeSeconds },
        suspendData: cmi["cmi.suspend_data"] ?? session.attempt.suspendData,
        lastStatement: {
          cmi,
          finished: Boolean(payload.finish),
          sequence: payload.sequence,
        },
      },
    });
    const pendingPackages = item.lessonId
      ? await database.externalPackage.count({
          where: {
            lessonId: item.lessonId,
            type: "SCORM_12",
            status: "READY",
            attempts: {
              none: {
                userId,
                completionStatus: { in: ["passed", "completed"] },
              },
            },
          },
        })
      : 0;
    if (
      item.lessonId &&
      !pendingPackages &&
      hasLearningAccess(enrollment) &&
      (status === "passed" || status === "completed")
    ) {
      await database.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId: item.lessonId } },
        create: { userId, lessonId: item.lessonId, completedAt: new Date() },
        update: { completedAt: new Date() },
      });
      await recordCourseEvent(database, {
        userId,
        courseId: item.courseId,
        type: "lesson.completed",
        idempotencyKey: `lesson-completed:${userId}:${item.lessonId}`,
        payload: { lessonId: item.lessonId },
      });
      await reconcileLearningCompletion(database, userId, item.courseId);
    }
    if (item.lessonId && pendingPackages && hasLearningAccess(enrollment)) {
      await database.lessonProgress.updateMany({
        where: { userId, lessonId: item.lessonId, completedAt: { not: null } },
        data: { completedAt: null },
      });
      await reconcileLearningCompletion(database, userId, item.courseId);
    }
    return { saved: true, sequence: payload.sequence };
  });
}
