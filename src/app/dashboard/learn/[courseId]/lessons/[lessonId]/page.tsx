import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { markLessonCompleteAction } from "@/app/dashboard/courses/actions";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackNotice, getLearnCourse } from "@/lib/dashboard-data";
import { LessonMarkdown } from "@/lib/lesson-markdown";
import { SetupMessage } from "@/lib/setup-message";

type ResourceLink = {
  id: string;
  fileUrl: string;
  title: string;
};

export default async function LessonPlayerPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const user = await getCurrentAppUser();
  const { mode, course, completedLessonIds } = await getLearnCourse(user, courseId);
  if (!course && mode !== "permission") notFound();

  const completedIds: string[] = completedLessonIds;
  const lessons = course?.sections.flatMap((section) => section.lessons) ?? [];
  const lesson = lessons.find((item) => item.id === lessonId) ?? lessons[0];
  const lessonContent =
    lesson && "content" in lesson && typeof lesson.content === "string"
      ? lesson.content
      : "";
  const resources: ResourceLink[] =
    lesson && "resources" in lesson && Array.isArray(lesson.resources)
      ? (lesson.resources as ResourceLink[])
      : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {mode === "fallback" ? <SetupMessage {...fallbackNotice()} /> : null}
      <section className="space-y-5">
        <div className="aspect-video rounded-lg border bg-[linear-gradient(135deg,var(--primary),var(--secondary))] p-8 text-primary-foreground">
          <p className="text-sm font-medium opacity-80">Lesson player</p>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold">
            {lesson?.title ?? "Lesson access"}
          </h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Lesson notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
            {mode === "permission" ? (
              <p className="rounded-md border p-4">
                Enroll in this course to access lessons.
              </p>
            ) : (
              <LessonMarkdown content={lessonContent} />
            )}
            {mode === "database" && lesson ? (
              <form action={markLessonCompleteAction.bind(null, lesson.id)}>
                <Button>
                  <CheckCircle2 className="h-4 w-4" />
                  {completedIds.includes(lesson.id) ? "Completed" : "Mark complete"}
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </section>
      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Course lessons</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lessons.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/learn/${course?.id}/lessons/${item.id}`}
                className="block rounded-md border p-3 text-sm hover:bg-muted"
              >
                {item.title}
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No resources attached.
              </p>
            ) : null}
            {resources.map((resource) => (
              <Button
                key={resource.id}
                asChild
                variant="outline"
                className="w-full justify-start"
              >
                <Link href={resource.fileUrl}>
                  <Download className="h-4 w-4" />
                  {resource.title}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
