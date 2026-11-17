import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { AssessmentAttemptForm } from "@/components/forms/assessment-attempt-form";
import { SetupMessage } from "@/lib/setup-message";
import { missingEnv } from "@/lib/env";
import { getCurrentAppUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  startAssessmentFormAction,
  submitAssessmentFormAction,
} from "@/app/dashboard/courses/actions";
import { canManageCourse } from "@/lib/permissions";
import { hasLearningAccess } from "@/lib/learning";
import { canShowAssessmentFeedback } from "@/lib/assessments";

export default async function TakeAssessmentPage({
  params,
}: {
  params: Promise<{ courseId: string; assessmentId: string }>;
}) {
  const { courseId, assessmentId } = await params;
  const databaseMissing = missingEnv(["DATABASE_URL"]).length > 0;
  const user = await getCurrentAppUser();
  const assessment = databaseMissing
    ? null
    : await prisma.assessment.findUnique({
        where: { id: assessmentId },
        include: {
          course: true,
          questions: { orderBy: { position: "asc" } },
          submissions: {
            where: { userId: user?.id ?? "__anonymous__" },
            orderBy: { attemptNumber: "desc" },
            take: 1,
          },
          attempts: {
            where: { userId: user?.id ?? "__anonymous__" },
            orderBy: { attemptNumber: "desc" },
            take: 1,
          },
        },
      });
  if (!databaseMissing && (!assessment || assessment.courseId !== courseId))
    notFound();
  if (assessment) {
    const enrollment = user
      ? await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: user.id, courseId } },
        })
      : null;
    if (
      !user ||
      (!canManageCourse(user, assessment.course) &&
        !hasLearningAccess(enrollment))
    )
      notFound();
  }
  const now = new Date();
  const latest = assessment?.submissions[0];
  const lastAttempt = assessment?.attempts[0];
  const pending = lastAttempt && !lastAttempt.submittedAt ? lastAttempt : null;
  const attempts = Math.max(
    lastAttempt?.attemptNumber ?? 0,
    latest?.attemptNumber ?? 0,
  );
  const exhausted = !!(
    assessment?.maxAttempts && attempts >= assessment.maxAttempts
  );
  const closed = !!(assessment?.closesAt && assessment.closesAt <= now);
  const feedbackVisible = !!(
    latest &&
    assessment &&
    canShowAssessmentFeedback(
      assessment.feedbackMode,
      latest.passed,
      assessment.closesAt,
      now,
    )
  );
  const effectiveDeadline =
    pending?.deadlineAt && assessment?.closesAt
      ? new Date(
          Math.min(pending.deadlineAt.getTime(), assessment.closesAt.getTime()),
        )
      : (pending?.deadlineAt ?? assessment?.closesAt);
  return (
    <div className="max-w-3xl space-y-6">
      <Button variant="ghost" asChild>
        <Link href={`/dashboard/learn/${courseId}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to course
        </Link>
      </Button>
      {databaseMissing ? (
        <SetupMessage
          title="Supabase setup required"
          items={[
            "Assessment submissions require DATABASE_URL and DIRECT_URL.",
          ]}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{assessment?.title ?? "Assessment"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {assessment?.description ? (
            <p className="text-sm text-muted-foreground">
              {assessment.description}
            </p>
          ) : null}
          {assessment ? (
            <p className="text-sm text-muted-foreground">
              Passing score: {assessment.passingScore}% · {attempts} attempt
              {attempts === 1 ? "" : "s"} used
              {assessment.maxAttempts
                ? ` of ${assessment.maxAttempts}`
                : " (unlimited)"}
              {assessment.timeLimitMinutes
                ? ` · ${assessment.timeLimitMinutes} minute time limit`
                : ""}
            </p>
          ) : null}
          {assessment?.closesAt ? (
            <p className="text-sm">
              Closes:{" "}
              <time dateTime={assessment.closesAt.toISOString()}>
                {assessment.closesAt.toUTCString()}
              </time>
              {assessment.feedbackMode === "AFTER_CLOSE"
                ? ". Results are released at this time."
                : "."}
            </p>
          ) : null}
          {latest && feedbackVisible ? (
            <p className="rounded-md border p-4 text-sm">
              Latest score: {latest.score}% ·{" "}
              {latest.passed ? "Passed" : "Not passed"}
              {latest.feedback ? ` · ${latest.feedback}` : ""}
            </p>
          ) : null}
          {latest && !feedbackVisible ? (
            <p className="rounded-md border p-4 text-sm">
              Your submission has been recorded. Results are not available under
              this assessment’s feedback policy.
            </p>
          ) : null}
          {pending && assessment ? (
            <AssessmentAttemptForm
              key={pending.id}
              attemptId={pending.id}
              remainingMilliseconds={
                effectiveDeadline
                  ? Math.max(0, effectiveDeadline.getTime() - now.getTime())
                  : null
              }
              questions={assessment.questions.map(
                ({ id, prompt, options }) => ({
                  id,
                  prompt,
                  options: Array.isArray(options)
                    ? options.filter(
                        (option): option is string =>
                          typeof option === "string",
                      )
                    : [],
                }),
              )}
              action={submitAssessmentFormAction.bind(
                null,
                courseId,
                assessmentId,
              )}
            />
          ) : closed ? (
            <p role="status">This assessment is closed.</p>
          ) : exhausted ? (
            <p role="status">
              You have used all available attempts. Contact your instructor if
              you need help.
            </p>
          ) : assessment && user ? (
            <ActionForm
              action={startAssessmentFormAction.bind(
                null,
                courseId,
                assessmentId,
              )}
            >
              <p className="mb-4 text-sm text-muted-foreground">
                Starting uses one attempt.{" "}
                {assessment.timeLimitMinutes
                  ? "The timer keeps running if you leave or refresh this page. Expired attempts receive no credit."
                  : "You can return to this page to resume your attempt."}
              </p>
              <PendingSubmitButton
                disabled={!assessment.questions.length}
                pendingLabel="Starting..."
              >
                Start assessment
              </PendingSubmitButton>
            </ActionForm>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
