import Link from "next/link";
import { GripVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createLessonAction,
  createSectionAction,
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
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Curriculum</h1>
          <p className="mt-2 text-muted-foreground">
            Reorder sections and lessons, add content, attach video URLs, and
            upload resources.
          </p>
        </div>
      </div>
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
            <form action={createSectionAction.bind(null, course.id)} className="flex max-w-xl gap-2">
              <Input name="title" placeholder="Section title" required />
              <Button type="submit">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <div className="space-y-4">
        {course?.sections.length === 0 ? (
          <p className="rounded-md border p-4 text-sm text-muted-foreground">
            This course does not have any sections yet.
          </p>
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
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/courses/${courseId}/lessons/${lesson.id}/edit`}>
                      Edit lesson
                    </Link>
                  </Button>
                </div>
              ))}
              {mode === "database" && "id" in section ? (
                <form
                  action={createLessonAction.bind(null, section.id)}
                  className="mt-4 grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-[1fr_1fr_120px_auto]"
                >
                  <Input name="title" placeholder="Lesson title" required />
                  <Input name="videoUrl" placeholder="Video URL" />
                  <Input name="durationMinutes" type="number" min="0" placeholder="Minutes" />
                  <Button type="submit" variant="outline">
                    <Plus className="h-4 w-4" />
                    Lesson
                  </Button>
                  <Textarea
                    name="content"
                    placeholder="Lesson notes"
                    className="md:col-span-4"
                  />
                </form>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
