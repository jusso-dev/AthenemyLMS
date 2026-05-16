import Link from "next/link";
import {
  Archive,
  FileUp,
  LibraryBig,
  Plus,
  Rocket,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import {
  archiveCourseFormAction,
  importPresentationCourseFormAction,
  publishCourseFormAction,
  restoreCourseFormAction,
} from "@/app/dashboard/courses/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackNotice, getManageCourses } from "@/lib/dashboard-data";
import { SetupMessage } from "@/lib/setup-message";
import { formatPrice } from "@/lib/utils";

export default async function ManageCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const query = await searchParams;
  const q = Array.isArray(query.q) ? query.q[0] : query.q;
  const user = await getCurrentAppUser();
  const { mode, courses } = await getManageCourses(user, q);

  return (
    <div className="space-y-8">
      {mode === "fallback" ? <SetupMessage {...fallbackNotice()} /> : null}
      <PageHeader
        title="Courses"
        description="Create, edit, publish, and inspect the learning products in your catalogue."
        actions={
          <Button asChild>
            <Link href="/dashboard/courses/new">
              <Plus className="h-4 w-4" />
              New course
            </Link>
          </Button>
        }
      />
      <form className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          aria-label="Filter courses"
          type="search"
          name="q"
          placeholder="Filter courses"
          defaultValue={q}
          className="pl-9"
        />
      </form>
      {mode !== "permission" ? (
        <Card>
          <CardHeader>
            <CardTitle>Build from slides</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={importPresentationCourseFormAction}
              className="grid gap-4"
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">PowerPoint file</span>
                  <Input
                    name="presentationFile"
                    type="file"
                    accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    disabled={mode !== "database"}
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Google Slides URL</span>
                  <Input
                    name="googleSlidesUrl"
                    type="url"
                    placeholder="https://docs.google.com/presentation/d/..."
                    disabled={mode !== "database"}
                  />
                </label>
                <div className="flex items-end">
                  <PendingSubmitButton
                    disabled={mode !== "database"}
                    pendingLabel="Importing..."
                  >
                    <FileUp className="h-4 w-4" />
                    Import slides
                  </PendingSubmitButton>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Creates a draft course with one lesson per slide. Embedded
                images under the import limit are added to lesson notes. Private
                Google decks need sharing/export access.
              </p>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Course list</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mode === "permission" ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Instructor or admin access is required to manage courses.
            </p>
          ) : null}
          {mode !== "permission" && courses.length === 0 ? (
            <EmptyState
              icon={LibraryBig}
              title={q ? "No matching courses" : "No courses yet"}
              description={
                q
                  ? "Try a different title or subtitle search."
                  : "Start with a draft course, then add sections, lessons, assessments, and publishing details."
              }
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/courses/new">Create course</Link>
                </Button>
              }
            />
          ) : null}
          {courses.map((course) => (
            <div
              key={course.id}
              className="grid gap-4 rounded-md border p-4 md:grid-cols-[1fr_auto_auto]"
            >
              <div>
                <p className="font-medium">{course.title}</p>
                <p className="text-sm text-muted-foreground">
                  {course.subtitle}
                </p>
              </div>
              <Badge
                variant={course.status === "PUBLISHED" ? "success" : "outline"}
              >
                {course.status}
              </Badge>
              <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                <span className="text-sm font-medium">
                  {formatPrice(course.priceCents, course.currency)}
                </span>
                {course.status === "DRAFT" ? (
                  <ActionForm
                    action={publishCourseFormAction.bind(null, course.id)}
                    inlineMessage={false}
                  >
                    <PendingSubmitButton size="sm" pendingLabel="Publishing...">
                      <Rocket className="h-4 w-4" />
                      Publish
                    </PendingSubmitButton>
                  </ActionForm>
                ) : null}
                {course.status === "ARCHIVED" ? (
                  <ActionForm
                    action={restoreCourseFormAction.bind(null, course.id)}
                    inlineMessage={false}
                  >
                    <PendingSubmitButton
                      size="sm"
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
                      size="sm"
                      variant="outline"
                      pendingLabel="Archiving..."
                    >
                      <Archive className="h-4 w-4" />
                      Archive
                    </PendingSubmitButton>
                  </ActionForm>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/courses/${course.id}/edit`}>
                    Edit
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
