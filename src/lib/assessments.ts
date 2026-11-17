import { prisma } from "@/lib/prisma";
import type { AssessmentFeedbackMode, Prisma } from "@prisma/client";

export type QuizQuestion = {
  id: string;
  correctIndex: number;
};

export function parseQuizOptions(value: string) {
  return value
    .split("\n")
    .map((option) => option.trim())
    .filter(Boolean);
}

export function parseAssessmentAnswers(
  questions: Array<{ id: string; options: unknown }>,
  formData: FormData,
  allowUnanswered = false,
) {
  if (questions.length === 0)
    throw new Error("This assessment has no questions yet.");
  return Object.fromEntries(
    questions.map((question) => {
      const value = formData.get(`question-${question.id}`);
      if (allowUnanswered && value === null) return [question.id, -1];
      const answer =
        typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
      if (
        !Number.isSafeInteger(answer) ||
        !Array.isArray(question.options) ||
        answer >= question.options.length
      ) {
        throw new Error("Choose a valid answer for every question.");
      }
      return [question.id, answer];
    }),
  );
}

export function canShowAssessmentFeedback(
  mode: AssessmentFeedbackMode,
  passed: boolean,
  closesAt?: Date | null,
  now = new Date(),
) {
  return (
    mode === "IMMEDIATE" ||
    (mode === "AFTER_PASSING" && passed) ||
    (mode === "AFTER_CLOSE" && !!closesAt && now >= closesAt)
  );
}
export function assertSupportedAssessmentSettings(settings: {
  timeLimitMinutes?: number | string | null;
  feedbackMode: string;
  closesAt?: Date | string | null;
}) {
  if (settings.feedbackMode === "AFTER_CLOSE" && !settings.closesAt) {
    throw new Error("Choose a closing time to release feedback after close.");
  }
  if (
    settings.closesAt &&
    !Number.isFinite(new Date(settings.closesAt).getTime())
  ) {
    throw new Error("Choose a valid closing time.");
  }
}
export function assessmentDeadline(
  startedAt: Date,
  timeLimitMinutes: number | null,
  closesAt: Date | null,
) {
  const timeDeadline = timeLimitMinutes
    ? new Date(startedAt.getTime() + timeLimitMinutes * 60_000)
    : null;
  if (!timeDeadline) return closesAt;
  return closesAt && closesAt < timeDeadline ? closesAt : timeDeadline;
}
export function scoreQuiz(
  questions: QuizQuestion[],
  answers: Record<string, number>,
) {
  if (questions.length === 0) return 0;
  const correct = questions.filter(
    (question) => answers[question.id] === question.correctIndex,
  ).length;
  return Math.round((correct / questions.length) * 100);
}

export async function getCompletionGateStatus(
  userId: string,
  courseId: string,
  database: Prisma.TransactionClient = prisma,
) {
  const requiredAssessments = await database.assessment.findMany({
    where: { courseId, requiredForCompletion: true },
    select: { id: true, title: true },
  });

  if (requiredAssessments.length === 0) {
    return { required: false, passed: true, missing: [] };
  }

  const passedSubmissions = await database.assessmentSubmission.findMany({
    where: {
      userId,
      passed: true,
      assessmentId: {
        in: requiredAssessments.map((assessment) => assessment.id),
      },
    },
    select: { assessmentId: true },
  });
  const passedIds = new Set(
    passedSubmissions.map((submission) => submission.assessmentId),
  );
  const missing = requiredAssessments.filter(
    (assessment) => !passedIds.has(assessment.id),
  );

  return { required: true, passed: missing.length === 0, missing };
}
