import { prisma } from "@/lib/prisma";

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

export async function getCompletionGateStatus(userId: string, courseId: string) {
  const requiredAssessments = await prisma.assessment.findMany({
    where: { courseId, requiredForCompletion: true },
    select: { id: true, title: true },
  });

  if (requiredAssessments.length === 0) {
    return { required: false, passed: true, missing: [] };
  }

  const passedSubmissions = await prisma.assessmentSubmission.findMany({
    where: {
      userId,
      passed: true,
      assessmentId: { in: requiredAssessments.map((assessment) => assessment.id) },
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
