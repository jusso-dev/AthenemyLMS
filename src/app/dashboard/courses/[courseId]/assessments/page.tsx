import Link from "next/link";
import { ClipboardCheck, Plus } from "lucide-react";
import { CourseManagementNav } from "@/components/courses/course-management-nav";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SetupMessage } from "@/lib/setup-message";
import { missingEnv } from "@/lib/env";
import { getCurrentAppUser } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createAssessmentFormAction } from "@/app/dashboard/courses/actions";

export default async function CourseAssessmentsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const databaseMissing = missingEnv(["DATABASE_URL"]).length > 0;
  const user = await getCurrentAppUser();
  const course = databaseMissing
    ? null
    : await prisma.course.findUnique({
        where: { id: courseId },
        include: {
          assessments: {
            include: { questions: true },
            orderBy: { createdAt: "desc" },
          },
        },
      });
  const allowed = course ? canManageCourse(user, course) : false;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        eyebrow={course?.title}
        title="Assessments"
        description="Add quiz checks and optional completion gates for this course."
      />
      <CourseManagementNav courseId={courseId} />
      {databaseMissing ? (
        <SetupMessage
          title="Supabase setup required"
          items={["Assessment authoring requires DATABASE_URL and DIRECT_URL."]}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Create quiz</CardTitle>
        </CardHeader>
        <CardContent>
          {!databaseMissing && !allowed ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Instructor or admin access is required to manage assessments.
            </p>
          ) : (
            <ActionForm
              action={createAssessmentFormAction.bind(null, courseId)}
              className="grid gap-4"
            >
              <Input
                name="title"
                placeholder="Quiz title"
                required
                disabled={databaseMissing || !allowed}
              />
              <Textarea
                name="description"
                placeholder="Short description"
                disabled={databaseMissing || !allowed}
              />
              <Textarea
                name="prompt"
                placeholder="Question prompt"
                required
                disabled={databaseMissing || !allowed}
              />
              <Textarea
                name="options"
                placeholder={"Answer options, one per line"}
                required
                disabled={databaseMissing || !allowed}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  name="correctIndex"
                  type="number"
                  min="0"
                  placeholder="Correct option index"
                  required
                  disabled={databaseMissing || !allowed}
                />
                <Input
                  name="passingScore"
                  type="number"
                  min="1"
                  max="100"
                  defaultValue="70"
                  disabled={databaseMissing || !allowed}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  name="maxAttempts"
                  type="number"
                  min="1"
                  max="20"
                  placeholder="Attempt limit"
                  disabled={databaseMissing || !allowed}
                />
                <Input
                  name="timeLimitMinutes"
                  type="number"
                  min="1"
                  max="600"
                  placeholder="Time limit"
                  disabled={databaseMissing || !allowed}
                />
                <label className="grid gap-2 text-sm font-medium">
                  Feedback
                  <select
                    name="feedbackMode"
                    defaultValue="IMMEDIATE"
                    disabled={databaseMissing || !allowed}
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="IMMEDIATE">Immediate</option>
                    <option value="AFTER_PASSING">After passing</option>
                    <option value="AFTER_CLOSE">After close</option>
                    <option value="HIDDEN">Hidden</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="requiredForCompletion"
                  disabled={databaseMissing || !allowed}
                />
                Require passing this quiz for completion
              </label>
              <PendingSubmitButton
                className="w-fit"
                disabled={databaseMissing || !allowed}
                pendingLabel="Creating..."
              >
                <Plus className="h-4 w-4" />
                Create quiz
              </PendingSubmitButton>
            </ActionForm>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Existing assessments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {course?.assessments.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No assessments yet"
              description="Create a quiz to check understanding or gate course completion."
            />
          ) : null}
          {course?.assessments.map((assessment) => (
            <div key={assessment.id} className="rounded-md border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{assessment.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {assessment.questions.length} question ·{" "}
                    {assessment.passingScore}% to pass
                    {assessment.maxAttempts
                      ? ` · ${assessment.maxAttempts} attempts`
                      : ""}
                    {assessment.requiredForCompletion
                      ? " · completion gate"
                      : ""}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={`/dashboard/courses/${courseId}/assessments/${assessment.id}`}
                  >
                    Manage
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
