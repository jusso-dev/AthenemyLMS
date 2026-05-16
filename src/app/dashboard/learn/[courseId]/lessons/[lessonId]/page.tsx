import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { markLessonCompleteFormAction } from "@/app/dashboard/courses/actions";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackNotice, getLearnCourse } from "@/lib/dashboard-data";
import { LessonMarkdown } from "@/lib/lesson-markdown";
import { SetupMessage } from "@/lib/setup-message";
import { getVideoPlayback } from "@/lib/video";

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
  const { mode, course, completedLessonIds } = await getLearnCourse(
    user,
    courseId,
    { includeLessonContent: true },
  );
  if (!course && mode !== "permission") notFound();

  const completedIds: string[] = completedLessonIds;
  const lessons = course?.sections.flatMap((section) => section.lessons) ?? [];
  const lesson = lessons.find((item) => item.id === lessonId) ?? lessons[0];
  const activeSection = course?.sections.find((section) =>
    section.lessons.some((item) => item.id === lesson?.id),
  );
  const activeLessonIndex = lesson
    ? lessons.findIndex((item) => item.id === lesson.id)
    : -1;
  const previousLesson =
    activeLessonIndex > 0 ? lessons[activeLessonIndex - 1] : null;
  const nextLesson =
    activeLessonIndex >= 0 && activeLessonIndex < lessons.length - 1
      ? lessons[activeLessonIndex + 1]
      : null;
  const progressPercent = lessons.length
    ? Math.round((completedIds.length / lessons.length) * 100)
    : 0;
  const lessonContent =
    lesson && "content" in lesson && typeof lesson.content === "string"
      ? lesson.content
      : "";
  const videoUrl =
    lesson && "videoUrl" in lesson && typeof lesson.videoUrl === "string"
      ? lesson.videoUrl
      : "";
  const playback = getVideoPlayback(videoUrl);
  const resources: ResourceLink[] =
    lesson && "resources" in lesson && Array.isArray(lesson.resources)
      ? (lesson.resources as ResourceLink[])
      : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {mode === "fallback" ? <SetupMessage {...fallbackNotice()} /> : null}
      <section className="space-y-5">
        {playback?.kind === "video" ? (
          <video
            controls
            className="aspect-video w-full rounded-lg border bg-black"
            src={playback.src}
          />
        ) : playback?.kind === "iframe" ? (
          <iframe
            className="aspect-video w-full rounded-lg border"
            src={playback.src}
            title={playback.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : null}
        <Card>
          <CardHeader className="border-b pb-5">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {activeSection?.title ?? course?.title ?? "Course lesson"}
            </p>
            <CardTitle className="text-2xl leading-tight">
              {lesson?.title ?? "Lesson notes"}
            </CardTitle>
            {lesson?.durationMinutes ? (
              <p className="text-sm text-muted-foreground">
                {lesson.durationMinutes} min lesson
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {mode === "permission" ? (
              <p className="rounded-md border p-4">
                Enroll in this course to access lessons.
              </p>
            ) : (
              <LessonMarkdown content={lessonContent} />
            )}
            {mode === "database" && lesson ? (
              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <ActionForm
                  action={markLessonCompleteFormAction.bind(null, lesson.id)}
                >
                  <PendingSubmitButton pendingLabel="Updating...">
                    <CheckCircle2 className="h-4 w-4" />
                    {completedIds.includes(lesson.id)
                      ? "Completed"
                      : "Mark complete"}
                  </PendingSubmitButton>
                </ActionForm>
                <div className="flex gap-2">
                  {previousLesson ? (
                    <Button asChild variant="outline">
                      <Link
                        href={`/dashboard/learn/${courseId}/lessons/${previousLesson.id}`}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Previous
                      </Link>
                    </Button>
                  ) : null}
                  {nextLesson ? (
                    <Button asChild>
                      <Link
                        href={`/dashboard/learn/${courseId}/lessons/${nextLesson.id}`}
                      >
                        Next lesson
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Course progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Progress value={progressPercent} />
              <p className="mt-2 text-xs text-muted-foreground">
                {completedIds.length} of {lessons.length} lessons complete
              </p>
            </div>
            {lessons.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/learn/${course?.id}/lessons/${item.id}`}
                aria-current={item.id === lesson?.id ? "page" : undefined}
                className={[
                  "flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted",
                  item.id === lesson?.id ? "bg-muted text-foreground" : "",
                ].join(" ")}
              >
                <span>{item.title}</span>
                {completedIds.includes(item.id) ? (
                  <CheckCircle2 className="h-4 w-4 text-secondary" />
                ) : null}
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
