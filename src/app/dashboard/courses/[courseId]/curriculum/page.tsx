import Link from "next/link";
import { BookOpen, GripVertical, Plus } from "lucide-react";
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
import {
  createLessonFormAction,
  createSectionFormAction,
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
        {course?.sections.map((section, sectionIndex) => (
          <Card key={section.title}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>
                Section {sectionIndex + 1}: {section.title}
              </CardTitle>
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              {section.lessons.map((lesson, lessonIndex) => (
                <div
                  key={lesson.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {lessonIndex + 1}. {lesson.title}
                    </span>
                  </div>
                  <div className="flex gap-2">
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
        ))}
      </div>
    </div>
  );
}
