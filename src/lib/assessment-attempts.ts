import { type Assessment, Prisma } from "@prisma/client";
import { learningTransaction } from "@/lib/learning";
import { assessmentDeadline } from "@/lib/assessments";

type AttemptSettings = Pick<
  Assessment,
  "id" | "maxAttempts" | "timeLimitMinutes" | "closesAt"
>;

/** Called inside the serializable learning transaction, after access checks. */
export async function startOrResumeAssessmentAttempt(
  database: Prisma.TransactionClient,
  assessment: AttemptSettings,
  userId: string,
  now = new Date(),
) {
  const pending = await database.assessmentAttempt.findFirst({
    where: { assessmentId: assessment.id, userId, submittedAt: null },
    orderBy: { attemptNumber: "desc" },
  });
  // Resume expired attempts too: submitting records their zero-credit result.
  // The reserved attempt number already consumes the attempt allowance.
  if (pending) return pending;
  if (assessment.closesAt && assessment.closesAt <= now)
    throw new Error("This assessment is closed.");
  const [attempts, submissions] = await Promise.all([
    database.assessmentAttempt.aggregate({
      where: { assessmentId: assessment.id, userId },
      _max: { attemptNumber: true },
    }),
    database.assessmentSubmission.aggregate({
      where: { assessmentId: assessment.id, userId },
      _max: { attemptNumber: true },
    }),
  ]);
  const used = Math.max(
    attempts._max.attemptNumber ?? 0,
    submissions._max.attemptNumber ?? 0,
  );
  if (assessment.maxAttempts && used >= assessment.maxAttempts)
    throw new Error("You used all attempts for this assessment.");
  return database.assessmentAttempt.create({
    data: {
      assessmentId: assessment.id,
      userId,
      attemptNumber: used + 1,
      startedAt: now,
      deadlineAt: assessmentDeadline(
        now,
        assessment.timeLimitMinutes,
        assessment.closesAt,
      ),
    },
  });
}

/** A uniqueness conflict can precede PostgreSQL's serialization error during
 * concurrent attempt creation/submission. Retry the entire transaction. */
export async function assessmentTransaction<T>(
  operation: (database: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await learningTransaction(operation);
    } catch (error) {
      if (
        attempt >= 2 ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      const target = error.meta?.target;
      if (
        !Array.isArray(target) ||
        !(
          target.join(",") === "attemptId" ||
          target.join(",") === "assessmentId,userId,attemptNumber"
        )
      )
        throw error;
    }
  }
}
