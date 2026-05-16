import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, ClipboardCheck, Trash2 } from "lucide-react";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import {
  createAssessmentQuestionFormAction,
  deleteAssessmentFormAction,
  deleteAssessmentQuestionFormAction,
  moveAssessmentQuestionFormAction,
  updateAssessmentFormAction,
  updateAssessmentQuestionFormAction,
} from "@/app/dashboard/courses/actions";
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
          items={[
            "Assessment management requires DATABASE_URL and DIRECT_URL.",
          ]}
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
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    aria-label="Attempt limit"
                    name="maxAttempts"
                    type="number"
                    min="1"
                    max="20"
                    defaultValue={assessment.maxAttempts ?? ""}
                    placeholder="Attempt limit"
                  />
                  <Input
                    aria-label="Time limit"
                    name="timeLimitMinutes"
                    type="number"
                    min="1"
                    max="600"
                    defaultValue={assessment.timeLimitMinutes ?? ""}
                    placeholder="Minutes"
                  />
                  <label className="grid gap-2 text-sm font-medium">
                    Feedback
                    <select
                      name="feedbackMode"
                      defaultValue={assessment.feedbackMode}
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="IMMEDIATE">Immediate</option>
                      <option value="AFTER_PASSING">After passing</option>
                      <option value="AFTER_CLOSE">After close</option>
                      <option value="HIDDEN">Hidden</option>
                    </select>
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
              <ActionForm
                action={createAssessmentQuestionFormAction.bind(
                  null,
                  courseId,
                  assessment.id,
                )}
                className="grid gap-3 rounded-md border bg-muted/20 p-4"
              >
                <p className="font-medium">Add question</p>
                <Textarea
                  name="prompt"
                  placeholder="Question prompt"
                  required
                />
                <Textarea
                  name="options"
                  placeholder="Answer options, one per line"
                  required
                />
                <div className="grid gap-3 sm:grid-cols-[180px_auto]">
                  <Input
                    name="correctIndex"
                    type="number"
                    min="0"
                    max="9"
                    placeholder="Correct option index"
                    required
                  />
                  <PendingSubmitButton
                    className="w-fit"
                    pendingLabel="Adding..."
                  >
                    Add question
                  </PendingSubmitButton>
                </div>
              </ActionForm>
              {assessment.questions.length === 0 ? (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No questions yet"
                  description="Add a question to start building this assessment."
                />
              ) : null}
              {assessment.questions.map((question, index) => (
                <div key={question.id} className="rounded-md border p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium">Question {index + 1}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        Answer {question.correctIndex + 1}
                      </Badge>
                      <ActionForm
                        action={moveAssessmentQuestionFormAction.bind(
                          null,
                          courseId,
                          assessment.id,
                          question.id,
                          "up",
                        )}
                        inlineMessage={false}
                      >
                        <PendingSubmitButton
                          variant="outline"
                          size="icon"
                          pendingLabel="..."
                          disabled={index === 0}
                          aria-label="Move question up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </PendingSubmitButton>
                      </ActionForm>
                      <ActionForm
                        action={moveAssessmentQuestionFormAction.bind(
                          null,
                          courseId,
                          assessment.id,
                          question.id,
                          "down",
                        )}
                        inlineMessage={false}
                      >
                        <PendingSubmitButton
                          variant="outline"
                          size="icon"
                          pendingLabel="..."
                          disabled={index === assessment.questions.length - 1}
                          aria-label="Move question down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </PendingSubmitButton>
                      </ActionForm>
                    </div>
                  </div>
                  <ActionForm
                    action={updateAssessmentQuestionFormAction.bind(
                      null,
                      courseId,
                      assessment.id,
                      question.id,
                    )}
                    className="grid gap-3"
                  >
                    <Textarea
                      name="prompt"
                      defaultValue={question.prompt}
                      required
                    />
                    <Textarea
                      name="options"
                      defaultValue={formatOptions(question.options)}
                      required
                    />
                    <div className="grid gap-3 sm:grid-cols-[180px_auto_auto]">
                      <Input
                        name="correctIndex"
                        type="number"
                        min="0"
                        max="9"
                        defaultValue={question.correctIndex}
                        required
                      />
                      <PendingSubmitButton
                        variant="outline"
                        className="w-fit"
                        pendingLabel="Saving..."
                      >
                        Save question
                      </PendingSubmitButton>
                    </div>
                  </ActionForm>
                  <ActionForm
                    action={deleteAssessmentQuestionFormAction.bind(
                      null,
                      courseId,
                      assessment.id,
                      question.id,
                    )}
                    className="mt-3 border-t pt-3"
                    inlineMessage={false}
                  >
                    <label className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        name="confirmDelete"
                        disabled={assessment.questions.length <= 1}
                      />
                      Confirm deleting this question
                    </label>
                    <PendingSubmitButton
                      variant="destructive"
                      size="sm"
                      pendingLabel="Deleting..."
                      disabled={assessment.questions.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete question
                    </PendingSubmitButton>
                  </ActionForm>
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

          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle>Delete assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={deleteAssessmentFormAction.bind(
                  null,
                  courseId,
                  assessment.id,
                )}
                className="grid gap-3"
              >
                <p className="text-sm text-muted-foreground">
                  This deletes the assessment, questions, and learner
                  submissions for this quiz.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="confirmDelete" />
                  Confirm deleting this assessment
                </label>
                <PendingSubmitButton
                  variant="destructive"
                  className="w-fit"
                  pendingLabel="Deleting..."
                >
                  <Trash2 className="h-4 w-4" />
                  Delete assessment
                </PendingSubmitButton>
              </ActionForm>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function formatOptions(value: unknown) {
  return Array.isArray(value) ? value.map(String).join("\n") : "";
}
