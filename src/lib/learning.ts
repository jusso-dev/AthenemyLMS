import { recordCourseEvent } from "@/lib/learning-events";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function hasLearningAccess(enrollment: { status: string } | null) {
  return enrollment?.status === "ACTIVE" || enrollment?.status === "COMPLETED";
}

/** Retry the entire operation so concurrent attempts/completions see fresh state. */
export async function learningTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        attempt >= 2 ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2034"
      ) {
        throw error;
      }
    }
  }
}

export async function getLearningCompletion(
  userId: string,
  courseId: string,
  database: Prisma.TransactionClient = prisma,
) {
  const [totalLessons, completedLessons, missingAssessments, missingScorm] =
    await Promise.all([
      database.lesson.count({ where: { section: { courseId } } }),
      database.lessonProgress.count({
        where: {
          userId,
          completedAt: { not: null },
          lesson: { section: { courseId } },
        },
      }),
      database.assessment.findMany({
        where: {
          courseId,
          requiredForCompletion: true,
          submissions: { none: { userId, passed: true } },
        },
        select: { id: true, title: true },
      }),
      database.externalPackage.findMany({
        where: {
          courseId,
          lessonId: { not: null },
          type: "SCORM_12",
          status: "READY",
          attempts: {
            none: { userId, completionStatus: { in: ["passed", "completed"] } },
          },
        },
        select: { id: true, title: true },
      }),
    ]);
  return {
    totalLessons,
    completedLessons,
    missingAssessments,
    missingScorm,
    complete:
      totalLessons > 0 &&
      completedLessons === totalLessons &&
      missingAssessments.length === 0 &&
      missingScorm.length === 0,
  };
}

export async function reconcileLearningCompletion(
  database: Prisma.TransactionClient,
  userId: string,
  courseId: string,
) {
  const enrollment = await database.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  // Course-manager previews must never create or reactivate enrollments.
  if (!hasLearningAccess(enrollment)) return;
  const completion = await getLearningCompletion(userId, courseId, database);
  const status = completion.complete ? "COMPLETED" : "ACTIVE";
  if (enrollment?.status !== status) {
    await database.enrollment.update({
      where: { userId_courseId: { userId, courseId } },
      data: { status },
    });
    if (status === "COMPLETED")
      await recordCourseEvent(database, {
        userId,
        courseId,
        type: "course.completed",
        idempotencyKey: `course-completed:${enrollment!.id}`,
      });
  }
}
