import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { updateAssessmentFormAction } from "@/app/dashboard/courses/actions";
import { CourseManagementNav } from "@/components/courses/course-management-nav";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentAppUser } from "@/lib/auth";
import { missingEnv } from "@/lib/env";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { SetupMessage } from "@/lib/setup-message";

export default async function AssessmentManagementPage({
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
            include: { user: true },
            orderBy: { createdAt: "desc" },
          },
        },
      });

  if (!databaseMissing && !assessment) notFound();

  const allowed = assessment ? canManageCourse(user, assessment.course) : false;

  return (
    <div className="max-w-5xl space-y-6">
      {databaseMissing ? (
        <SetupMessage
          title="Supabase setup required"
          items={["Assessment management requires DATABASE_URL and DIRECT_URL."]}
        />
      ) : null}
      <PageHeader
        eyebrow={assessment?.course.title}
        title={assessment?.title ?? "Assessment"}
        description="Manage quiz settings, inspect questions, and review learner submissions."
        actions={
          <Button asChild variant="outline">
            <Link href={`/dashboard/courses/${courseId}/assessments`}>
              Back to assessments
            </Link>
          </Button>
        }
      />
      <CourseManagementNav courseId={courseId} />
      {!allowed ? (
        <Card>
          <CardContent className="pt-6">
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Instructor or admin access is required to manage this assessment.
            </p>
          </CardContent>
        </Card>
      ) : null}
      {assessment && allowed ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Assessment settings</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={updateAssessmentFormAction.bind(
                  null,
                  courseId,
                  assessment.id,
                )}
                className="grid gap-4"
              >
                <Input
                  aria-label="Assessment title"
                  name="title"
                  defaultValue={assessment.title}
                  required
                />
                <Textarea
                  aria-label="Assessment description"
                  name="description"
                  defaultValue={assessment.description ?? ""}
                  placeholder="Short learner-facing description"
                />
                <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                  <Input
                    aria-label="Passing score"
                    name="passingScore"
                    type="number"
                    min="1"
                    max="100"
                    defaultValue={assessment.passingScore}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="requiredForCompletion"
                      defaultChecked={assessment.requiredForCompletion}
                    />
                    Require passing this assessment for completion
                  </label>
                </div>
                <PendingSubmitButton className="w-fit">
                  Save assessment
                </PendingSubmitButton>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {assessment.questions.length === 0 ? (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No questions yet"
                  description="Question editing will live here. Create a quiz question from the assessments list for now."
                />
              ) : null}
              {assessment.questions.map((question, index) => (
                <div key={question.id} className="rounded-md border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        Question {index + 1}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {question.prompt}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      Answer {question.correctIndex + 1}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Submissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {assessment.submissions.length === 0 ? (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No submissions yet"
                  description="Learner attempts will appear here with score and pass/fail status."
                />
              ) : null}
              {assessment.submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="grid gap-3 rounded-md border p-4 sm:grid-cols-[1fr_120px_120px]"
                >
                  <div>
                    <p className="font-medium">
                      {submission.user.name ?? "Unnamed learner"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {submission.user.email}
                    </p>
                  </div>
                  <p className="text-sm font-medium">{submission.score}%</p>
                  <Badge
                    variant={submission.passed ? "success" : "outline"}
                    className="w-fit"
                  >
                    {submission.passed ? "Passed" : "Needs review"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
