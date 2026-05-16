import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  ListChecks,
  Plus,
  Rocket,
  Settings,
  TriangleAlert,
  Video,
} from "lucide-react";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { CourseManagementNav } from "@/components/courses/course-management-nav";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveCourseFormAction,
  createLessonFormAction,
  createSectionFormAction,
  publishCourseFormAction,
} from "@/app/dashboard/courses/actions";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackNotice, databaseIsConfigured } from "@/lib/dashboard-data";
import { missingEnv } from "@/lib/env";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCoursePublishReadiness } from "@/lib/course-readiness";
import { SetupMessage } from "@/lib/setup-message";

export default async function CourseStudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { courseId } = await params;
  const { lesson: selectedLessonId } = await searchParams;
  const databaseReady = databaseIsConfigured();
  const user = await getCurrentAppUser();
  const course = databaseReady
    ? await prisma.course.findUnique({
        where: { id: courseId },
        include: {
          sections: {
            orderBy: { position: "asc" },
            include: {
              lessons: {
                orderBy: { position: "asc" },
                include: { resources: true },
              },
            },
          },
          assessments: {
            orderBy: { createdAt: "desc" },
            include: {
              _count: { select: { questions: true, submissions: true } },
            },
          },
        },
      })
    : null;

  if (databaseReady && !course) notFound();
  const allowed = canManageCourse(user, course);
  const lessons = course?.sections.flatMap((section) => section.lessons) ?? [];
  const selectedLesson =
    lessons.find((lesson) => lesson.id === selectedLessonId) ??
    lessons[0] ??
    null;
  const readiness = course ? getCoursePublishReadiness(course) : null;
  const totalMinutes = lessons.reduce(
    (total, lesson) => total + lesson.durationMinutes,
    0,
  );

  return (
    <div className="space-y-6">
      {missingEnv(["DATABASE_URL"]).length > 0 ? (
        <SetupMessage {...fallbackNotice()} />
      ) : null}
      <PageHeader
        eyebrow={course?.title ?? "Course"}
        title="Authoring studio"
        description="Build the outline, review lesson content, check publish readiness, and jump into focused editors from one workspace."
        actions={
          course && allowed ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={`/dashboard/learn/${course.id}`}>
                  <Eye className="h-4 w-4" />
                  Preview
                </Link>
              </Button>
              {course.status === "DRAFT" ? (
                <ActionForm
                  action={publishCourseFormAction.bind(null, course.id)}
                  inlineMessage={false}
                >
                  <PendingSubmitButton pendingLabel="Publishing...">
                    <Rocket className="h-4 w-4" />
                    Publish
                  </PendingSubmitButton>
                </ActionForm>
              ) : null}
              {course.status !== "ARCHIVED" ? (
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
              ) : null}
            </div>
          ) : null
        }
      />
      <CourseManagementNav courseId={courseId} />
      {!databaseReady || !course || !allowed ? (
        <Card>
          <CardContent className="pt-6">
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Instructor or admin access is required to use the authoring
              studio.
            </p>
          </CardContent>
        </Card>
      ) : null}
      {course && allowed ? (
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4" />
                  Outline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {course.sections.length === 0 ? (
                  <EmptyState
                    icon={BookOpen}
                    title="No outline yet"
                    description="Add a section and lesson to create the learner path."
                  />
                ) : null}
                {course.sections.map((section, sectionIndex) => (
                  <div key={section.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {sectionIndex + 1}. {section.title}
                      </p>
                      <Badge variant="outline">
                        {section.lessons.length} lessons
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {section.lessons.map((lesson, lessonIndex) => {
                        const active = selectedLesson?.id === lesson.id;
                        return (
                          <Link
                            key={lesson.id}
                            href={`/dashboard/courses/${course.id}/studio?lesson=${lesson.id}`}
                            className={[
                              "block rounded-md border px-3 py-2 text-sm transition-colors hover:border-ring hover:bg-muted/40",
                              active
                                ? "border-primary/40 bg-primary/10 text-foreground"
                                : "text-muted-foreground",
                            ].join(" ")}
                          >
                            <span className="font-medium text-foreground">
                              {sectionIndex + 1}.{lessonIndex + 1}{" "}
                              {lesson.title}
                            </span>
                            <span className="mt-1 flex flex-wrap gap-2 text-xs">
                              <span>{lesson.durationMinutes}m</span>
                              {lesson.videoUrl || lesson.videoAssetKey ? (
                                <span>Video</span>
                              ) : null}
                              {lesson.content ? <span>Notes</span> : null}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <ActionForm
                  action={createSectionFormAction.bind(null, course.id)}
                  className="grid gap-2 rounded-md border bg-muted/20 p-3"
                >
                  <Input name="title" placeholder="New section" required />
                  <PendingSubmitButton
                    variant="outline"
                    className="w-fit"
                    pendingLabel="Adding..."
                  >
                    <Plus className="h-4 w-4" />
                    Add section
                  </PendingSubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          </aside>

          <main className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Status" value={course.status} />
              <Metric label="Sections" value={course.sections.length} />
              <Metric label="Lessons" value={lessons.length} />
              <Metric label="Duration" value={`${totalMinutes}m`} />
            </div>
            <Card>
              <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>
                    {selectedLesson?.title ?? "Select or create a lesson"}
                  </CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Review the learner-facing content, then open the focused
                    editor for richer lesson work.
                  </p>
                </div>
                {selectedLesson ? (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/dashboard/courses/${course.id}/lessons/${selectedLesson.id}/edit`}
                      >
                        <FileText className="h-4 w-4" />
                        Edit content
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/dashboard/courses/${course.id}/lessons/${selectedLesson.id}/video`}
                      >
                        <Video className="h-4 w-4" />
                        Video
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent>
                {selectedLesson ? (
                  <div className="space-y-4">
                    <div className="rounded-md border bg-muted/20 p-4">
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span>{selectedLesson.durationMinutes} minutes</span>
                        <span>
                          {selectedLesson.resources.length} downloadable
                          resources
                        </span>
                        {selectedLesson.preview ? (
                          <span>Preview lesson</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="prose prose-slate max-w-none rounded-md border bg-background p-4 text-sm leading-7 dark:prose-invert">
                      {selectedLesson.content ? (
                        <pre className="whitespace-pre-wrap font-sans">
                          {selectedLesson.content}
                        </pre>
                      ) : (
                        <p className="text-muted-foreground">
                          This lesson does not have notes yet.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={FileText}
                    title="No lesson selected"
                    description="Create a lesson in the quick-add form or choose one from the outline."
                  />
                )}
              </CardContent>
            </Card>
            {course.sections[0] ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick lesson</CardTitle>
                </CardHeader>
                <CardContent>
                  <ActionForm
                    action={createLessonFormAction.bind(
                      null,
                      course.sections[0].id,
                    )}
                    className="grid gap-3 md:grid-cols-[1fr_160px_auto]"
                  >
                    <Input name="title" placeholder="Lesson title" required />
                    <Input
                      name="durationMinutes"
                      type="number"
                      min="0"
                      placeholder="Minutes"
                    />
                    <PendingSubmitButton
                      variant="outline"
                      pendingLabel="Adding..."
                    >
                      <Plus className="h-4 w-4" />
                      Add lesson
                    </PendingSubmitButton>
                    <Textarea
                      name="content"
                      placeholder="Starter notes"
                      className="md:col-span-3"
                    />
                  </ActionForm>
                </CardContent>
              </Card>
            ) : null}
          </main>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="h-4 w-4" />
                  Publish readiness
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {readiness?.score ?? 0}% ready
                    </span>
                    <Badge
                      variant={readiness?.canPublish ? "success" : "outline"}
                    >
                      {readiness?.canPublish ? "Can publish" : "Needs work"}
                    </Badge>
                  </div>
                  <Progress value={readiness?.score ?? 0} />
                </div>
                <div className="space-y-2">
                  {readiness?.items.map((item) => {
                    const Icon =
                      item.status === "complete" ? CheckCircle2 : TriangleAlert;
                    return (
                      <div key={item.id} className="rounded-md border p-3">
                        <div className="flex items-center gap-2">
                          <Icon
                            className={[
                              "h-4 w-4",
                              item.status === "complete"
                                ? "text-emerald-600"
                                : item.status === "blocked"
                                  ? "text-destructive"
                                  : "text-[color:var(--gold)]",
                            ].join(" ")}
                          />
                          <p className="text-sm font-medium">{item.label}</p>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {item.message}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="h-4 w-4" />
                  Next actions
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button asChild variant="outline">
                  <Link href={`/dashboard/courses/${course.id}/edit`}>
                    Course details
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/dashboard/courses/${course.id}/curriculum`}>
                    Curriculum manager
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/dashboard/courses/${course.id}/assessments`}>
                    <ClipboardCheck className="h-4 w-4" />
                    Assessments
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold">{value}</p>
    </div>
  );
}
