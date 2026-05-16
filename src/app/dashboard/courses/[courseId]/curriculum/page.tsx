import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  FileText,
  GripVertical,
  Plus,
  Video,
} from "lucide-react";
import { CourseManagementNav } from "@/components/courses/course-management-nav";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createLessonFormAction,
  createSectionFormAction,
  moveLessonFormAction,
  moveSectionFormAction,
} from "@/app/dashboard/courses/actions";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackNotice, getEditableCourse } from "@/lib/dashboard-data";
import { SetupMessage } from "@/lib/setup-message";

export default async function CurriculumPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const user = await getCurrentAppUser();
  const { mode, course } = await getEditableCourse(user, courseId);
  const totalLessons =
    course?.sections.reduce(
      (total, section) => total + section.lessons.length,
      0,
    ) ?? 0;
  const totalDuration =
    course?.sections.reduce(
      (total, section) =>
        total +
        section.lessons.reduce(
          (lessonTotal, lesson) => lessonTotal + lesson.durationMinutes,
          0,
        ),
      0,
    ) ?? 0;

  return (
    <div className="space-y-6">
      {mode === "fallback" ? <SetupMessage {...fallbackNotice()} /> : null}
      <PageHeader
        eyebrow={course?.title}
        title="Curriculum"
        description="Build the course map learners will follow: sections, lessons, video, notes, and supporting resources."
        actions={
          <Button asChild variant="outline">
            <Link href={`/dashboard/courses/${courseId}/assessments`}>
              Assessments
            </Link>
          </Button>
        }
      />
      {course ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border bg-card p-4">
            <p className="text-sm text-muted-foreground">Sections</p>
            <p className="mt-1 text-2xl font-semibold">
              {course.sections.length}
            </p>
          </div>
          <div className="rounded-md border bg-card p-4">
            <p className="text-sm text-muted-foreground">Lessons</p>
            <p className="mt-1 text-2xl font-semibold">{totalLessons}</p>
          </div>
          <div className="rounded-md border bg-card p-4">
            <p className="text-sm text-muted-foreground">Duration</p>
            <p className="mt-1 text-2xl font-semibold">{totalDuration}m</p>
          </div>
        </div>
      ) : null}
      <CourseManagementNav courseId={courseId} />
      {mode === "permission" || !course ? (
        <Card>
          <CardContent className="pt-6">
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Instructor or admin access is required to manage this curriculum.
            </p>
          </CardContent>
        </Card>
      ) : null}
      {course && mode === "database" ? (
        <Card>
          <CardHeader>
            <CardTitle>Add section</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={createSectionFormAction.bind(null, course.id)}
              className="flex max-w-xl gap-2"
            >
              <Input name="title" placeholder="Section title" required />
              <PendingSubmitButton pendingLabel="Adding...">
                <Plus className="h-4 w-4" />
                Add
              </PendingSubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
      <div className="space-y-4">
        {course?.sections.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No sections yet"
            description="Add the first section to create the spine of this course. Each section can hold lessons, videos, notes, and resources."
          />
        ) : null}
        {course?.sections.map((section, sectionIndex) => {
          const sectionDuration = section.lessons.reduce(
            (total, lesson) => total + lesson.durationMinutes,
            0,
          );

          return (
            <Card key={section.id}>
              <CardHeader className="gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GripVertical className="h-4 w-4" aria-hidden="true" />
                    Section {sectionIndex + 1}
                  </div>
                  <CardTitle className="mt-2 leading-snug">
                    {section.title}
                  </CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {section.lessons.length} lessons · {sectionDuration} minutes
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <ActionForm
                    action={moveSectionFormAction.bind(
                      null,
                      courseId,
                      section.id,
                      "up",
                    )}
                    inlineMessage={false}
                    className="inline-flex"
                  >
                    <PendingSubmitButton
                      variant="ghost"
                      size="icon"
                      pendingLabel="..."
                      disabled={sectionIndex === 0}
                      aria-label={`Move ${section.title} up`}
                      title="Move section up"
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </PendingSubmitButton>
                  </ActionForm>
                  <ActionForm
                    action={moveSectionFormAction.bind(
                      null,
                      courseId,
                      section.id,
                      "down",
                    )}
                    inlineMessage={false}
                    className="inline-flex"
                  >
                    <PendingSubmitButton
                      variant="ghost"
                      size="icon"
                      pendingLabel="..."
                      disabled={sectionIndex === course.sections.length - 1}
                      aria-label={`Move ${section.title} down`}
                      title="Move section down"
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </PendingSubmitButton>
                  </ActionForm>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {section.lessons.map((lesson, lessonIndex) => (
                  <div
                    key={lesson.id}
                    className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <GripVertical
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-medium">
                          {sectionIndex + 1}.{lessonIndex + 1} {lesson.title}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 pl-7 text-xs text-muted-foreground">
                        <span>{lesson.durationMinutes}m</span>
                        {lesson.preview ? (
                          <Badge variant="secondary">Preview</Badge>
                        ) : null}
                        <span className="inline-flex items-center gap-1">
                          <FileText
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          Notes
                        </span>
                        {lesson.videoUrl || lesson.videoAssetKey ? (
                          <span className="inline-flex items-center gap-1">
                            <Video
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Video
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 md:justify-end">
                      <ActionForm
                        action={moveLessonFormAction.bind(
                          null,
                          courseId,
                          lesson.id,
                          "up",
                        )}
                        inlineMessage={false}
                        className="inline-flex"
                      >
                        <PendingSubmitButton
                          variant="ghost"
                          size="icon"
                          pendingLabel="..."
                          disabled={sectionIndex === 0 && lessonIndex === 0}
                          aria-label={`Move ${lesson.title} up`}
                          title="Move lesson up"
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden="true" />
                        </PendingSubmitButton>
                      </ActionForm>
                      <ActionForm
                        action={moveLessonFormAction.bind(
                          null,
                          courseId,
                          lesson.id,
                          "down",
                        )}
                        inlineMessage={false}
                        className="inline-flex"
                      >
                        <PendingSubmitButton
                          variant="ghost"
                          size="icon"
                          pendingLabel="..."
                          disabled={
                            sectionIndex === course.sections.length - 1 &&
                            lessonIndex === section.lessons.length - 1
                          }
                          aria-label={`Move ${lesson.title} down`}
                          title="Move lesson down"
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden="true" />
                        </PendingSubmitButton>
                      </ActionForm>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/dashboard/courses/${courseId}/lessons/${lesson.id}/edit`}
                        >
                          Edit lesson
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/dashboard/courses/${courseId}/lessons/${lesson.id}/video`}
                        >
                          Video
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
                {section.lessons.length === 0 ? (
                  <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Add a lesson to this section to start building the learning
                    sequence.
                  </p>
                ) : null}
                {mode === "database" && "id" in section ? (
                  <ActionForm
                    action={createLessonFormAction.bind(null, section.id)}
                    className="mt-4 grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-[1fr_1fr_120px_auto]"
                  >
                    <Input name="title" placeholder="Lesson title" required />
                    <Input name="videoUrl" placeholder="Video URL" />
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
                      Lesson
                    </PendingSubmitButton>
                    <Textarea
                      name="content"
                      placeholder="Lesson notes"
                      className="md:col-span-4"
                    />
                  </ActionForm>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
