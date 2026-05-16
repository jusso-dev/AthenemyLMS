import { notFound } from "next/navigation";
import { Archive, Rocket, RotateCcw, Trash2 } from "lucide-react";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { CourseManagementNav } from "@/components/courses/course-management-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseForm } from "@/components/forms/course-form";
import { PageHeader } from "@/components/layout/page-header";
import {
  archiveCourseFormAction,
  deleteCourseFormAction,
  publishCourseFormAction,
  restoreCourseFormAction,
  updateCourseFormAction,
} from "@/app/dashboard/courses/actions";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackNotice, getEditableCourse } from "@/lib/dashboard-data";
import { SetupMessage } from "@/lib/setup-message";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const user = await getCurrentAppUser();
  const { mode, course } = await getEditableCourse(user, courseId);
  if (!course && mode !== "permission") notFound();

  return (
    <div className="max-w-5xl space-y-6">
      {mode === "fallback" ? <SetupMessage {...fallbackNotice()} /> : null}
      <PageHeader
        eyebrow={course?.title ?? "Permission required"}
        title="Course details"
        description="Set the public listing, pricing, publication state, and certificate behavior."
        actions={
          course && mode === "database" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={course.status === "PUBLISHED" ? "success" : "outline"}
              >
                {course.status}
              </Badge>
              {course.status === "DRAFT" ? (
                <ActionForm
                  action={publishCourseFormAction.bind(null, course.id)}
                  inlineMessage={false}
                >
                  <PendingSubmitButton pendingLabel="Publishing...">
                    <Rocket className="h-4 w-4" />
                    Publish course
                  </PendingSubmitButton>
                </ActionForm>
              ) : null}
              {course.status === "ARCHIVED" ? (
                <ActionForm
                  action={restoreCourseFormAction.bind(null, course.id)}
                  inlineMessage={false}
                >
                  <PendingSubmitButton
                    variant="outline"
                    pendingLabel="Restoring..."
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restore
                  </PendingSubmitButton>
                </ActionForm>
              ) : (
                <ActionForm
                  action={archiveCourseFormAction.bind(null, course.id)}
                  inlineMessage={false}
                >
                  <PendingSubmitButton
                    variant="outline"
                    pendingLabel="Archiving..."
                  >
                    <Archive className="h-4 w-4" />
                    Archive
                  </PendingSubmitButton>
                </ActionForm>
              )}
            </div>
          ) : null
        }
      />
      <CourseManagementNav courseId={courseId} />
      <Card>
        <CardHeader>
          <CardTitle>Listing and publishing</CardTitle>
        </CardHeader>
        <CardContent>
          {mode === "permission" || !course ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Instructor or admin access is required to edit this course.
            </p>
          ) : (
            <CourseForm
              stateAction={updateCourseFormAction.bind(null, course.id)}
              disabled={mode === "fallback"}
              defaults={{
                title: course.title,
                slug: course.slug,
                subtitle: course.subtitle ?? "",
                description: course.description ?? "",
                priceCents: course.priceCents,
                status: course.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
                thumbnailUrl:
                  "thumbnailUrl" in course ? (course.thumbnailUrl ?? "") : "",
              }}
              submitLabel={
                mode === "fallback"
                  ? "Configure Supabase to save"
                  : "Save course"
              }
            />
          )}
        </CardContent>
      </Card>
      {course && mode === "database" ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4">
              <p className="font-medium">Delete draft course</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Permanent deletion is only available for draft courses with no
                learner, payment, certificate, or assessment history. Published
                or active courses should be archived instead.
              </p>
            </div>
            <ActionForm
              action={deleteCourseFormAction.bind(null, course.id)}
              className="grid gap-3 sm:max-w-md"
            >
              <label className="grid gap-2 text-sm">
                <span className="font-medium">
                  Type {course.title} to confirm
                </span>
                <input
                  name="confirmTitle"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  autoComplete="off"
                />
              </label>
              <PendingSubmitButton
                className="w-fit"
                variant="destructive"
                pendingLabel="Deleting..."
              >
                <Trash2 className="h-4 w-4" />
                Delete permanently
              </PendingSubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
