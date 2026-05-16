import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { SetupMessage } from "@/lib/setup-message";
import { missingEnv } from "@/lib/env";
import { getCurrentAppUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitAssessmentFormAction } from "@/app/dashboard/courses/actions";

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
          questions: { orderBy: { position: "asc" } },
          submissions: {
            where: { userId: user?.id ?? "__anonymous__" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

  if (!databaseMissing && (!assessment || assessment.courseId !== courseId)) {
    notFound();
  }
  const latest = assessment?.submissions[0];

  return (
    <div className="max-w-3xl space-y-6">
      <Button asChild variant="outline" size="sm">
        <Link href={`/dashboard/learn/${courseId}`}>
          <ArrowLeft className="h-4 w-4" />
          Course
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
          {latest ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Latest score: {latest.score}% ·{" "}
              {latest.passed ? "Passed" : "Not passed"}
            </p>
          ) : null}
          {!user && !databaseMissing ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Sign in to submit this assessment.
            </p>
          ) : null}
          <ActionForm
            action={submitAssessmentFormAction.bind(
              null,
              courseId,
              assessmentId,
            )}
            className="space-y-5"
          >
            {assessment?.questions.map((question, questionIndex) => {
              const options = Array.isArray(question.options)
                ? (question.options as string[])
                : [];
              return (
                <fieldset key={question.id} className="rounded-md border p-4">
                  <legend className="px-1 text-sm font-medium">
                    {questionIndex + 1}. {question.prompt}
                  </legend>
                  <div className="mt-3 space-y-2">
                    {options.map((option, optionIndex) => (
                      <label
                        key={option}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={optionIndex}
                          required
                          disabled={!user || databaseMissing}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            <PendingSubmitButton
              disabled={!user || databaseMissing}
              pendingLabel="Submitting..."
            >
              Submit assessment
            </PendingSubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
