import Link from "next/link";
import { Users } from "lucide-react";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import {
  cancelCourseEnrollmentFormAction,
  enrollCourseLearnerFormAction,
} from "@/app/dashboard/courses/actions";
import { CourseManagementNav } from "@/components/courses/course-management-nav";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackNotice, getCourseStudents } from "@/lib/dashboard-data";
import { SetupMessage } from "@/lib/setup-message";

export default async function CourseStudentsPage({
  searchParams,
  params,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
  params: Promise<{ courseId: string }>;
}) {
  const query = await searchParams;
  const statusParam = Array.isArray(query.status)
    ? query.status[0]
    : query.status;
  const status = ["active", "completed", "cancelled"].includes(statusParam ?? "")
    ? statusParam
    : "all";
  const { courseId } = await params;
  const user = await getCurrentAppUser();
  const { mode, students, availableUsers, courseTitle } =
    await getCourseStudents(user, courseId);
  const filteredStudents = students.filter((student) => {
    if (status === "active") return student.status === "Active";
    if (status === "completed") return student.status === "Completed";
    if (status === "cancelled") return student.status === "Cancelled";
    return true;
  });

  return (
    <div className="space-y-6">
      {mode === "fallback" ? <SetupMessage {...fallbackNotice()} /> : null}
      <PageHeader
        eyebrow={courseTitle}
        title="Learners"
        description="Enrollment and progress summary for this course."
      />
      <CourseManagementNav courseId={courseId} />
      {mode === "database" ? (
        <Card>
          <CardHeader>
            <CardTitle>Add learners</CardTitle>
          </CardHeader>
          <CardContent>
            {availableUsers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No available learners"
                description="Everyone in scope is already enrolled, or no organization members exist yet."
              />
            ) : (
              <ActionForm
                action={enrollCourseLearnerFormAction.bind(null, courseId)}
                className="grid gap-3 sm:grid-cols-[1fr_auto]"
              >
                <select
                  aria-label="Learner"
                  name="userId"
                  required
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Choose a learner</option>
                  {availableUsers.map((availableUser) => (
                    <option key={availableUser.id} value={availableUser.id}>
                      {availableUser.name ?? availableUser.email} ·{" "}
                      {availableUser.email}
                    </option>
                  ))}
                </select>
                <PendingSubmitButton pendingLabel="Enrolling...">
                  Enroll learner
                </PendingSubmitButton>
              </ActionForm>
            )}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Enrolled learners</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mode === "database" ? (
            <div className="flex gap-2 overflow-x-auto border-b pb-3">
              {[
                {
                  href: `/dashboard/courses/${courseId}/students`,
                  label: "All",
                },
                {
                  href: `/dashboard/courses/${courseId}/students?status=active`,
                  label: "Active",
                },
                {
                  href: `/dashboard/courses/${courseId}/students?status=completed`,
                  label: "Completed",
                },
                {
                  href: `/dashboard/courses/${courseId}/students?status=cancelled`,
                  label: "Cancelled",
                },
              ].map((item) => {
                const active =
                  (status === "all" && item.label === "All") ||
                  status === item.label.toLowerCase();
                return (
                  <Button
                    key={item.href}
                    asChild
                    variant={active ? "secondary" : "ghost"}
                    size="sm"
                  >
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                );
              })}
            </div>
          ) : null}
          {mode === "permission" ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Instructor or admin access is required to view course students.
            </p>
          ) : null}
          {mode !== "permission" && filteredStudents.length === 0 ? (
            <EmptyState
              icon={Users}
              title={
                students.length === 0
                  ? "No enrolled learners"
                  : "No learners in this view"
              }
              description={
                students.length === 0
                  ? "Learners will appear here after they enroll or are assigned to this course."
                  : "Switch filters to see learners with a different enrollment status."
              }
            />
          ) : null}
          {filteredStudents.map((student) => (
            <div
              key={student.email}
              className="grid gap-3 rounded-md border p-4 sm:grid-cols-[1fr_160px_auto]"
            >
              <div>
                <p className="font-medium">{student.name}</p>
                <p className="text-sm text-muted-foreground">{student.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={student.progress} className="flex-1" />
                <span className="text-xs text-muted-foreground">
                  {student.progress}%
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Badge
                  variant={student.status === "Completed" ? "success" : "outline"}
                >
                  {student.status}
                </Badge>
                {student.status !== "Cancelled" ? (
                  <ActionForm
                    action={cancelCourseEnrollmentFormAction.bind(
                      null,
                      courseId,
                      student.userId,
                    )}
                    inlineMessage={false}
                  >
                    <PendingSubmitButton
                      size="sm"
                      variant="outline"
                      pendingLabel="Cancelling..."
                    >
                      Cancel access
                    </PendingSubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
