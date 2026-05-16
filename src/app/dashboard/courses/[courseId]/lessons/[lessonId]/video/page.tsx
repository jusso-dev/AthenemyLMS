import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LessonVideoForm } from "@/components/forms/lesson-video-form";
import { SetupMessage } from "@/lib/setup-message";
import { missingEnv } from "@/lib/env";
import { getCurrentAppUser } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { updateLessonVideoFormAction } from "@/app/dashboard/courses/actions";
import { formatVideoBytes, getVideoPlayback } from "@/lib/video";

export default async function LessonVideoPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const databaseMissing = missingEnv(["DATABASE_URL"]).length > 0;
  const user = await getCurrentAppUser();
  const lesson = databaseMissing
    ? null
    : await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { section: { include: { course: true } } },
      });

  if (!databaseMissing && !lesson) notFound();
  const allowed = lesson ? canManageCourse(user, lesson.section.course) : false;
  const playback = getVideoPlayback(lesson?.videoUrl);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Button asChild variant="outline" size="sm" className="mb-4">
          <Link href={`/dashboard/courses/${courseId}/curriculum`}>
            <ArrowLeft className="h-4 w-4" />
            Curriculum
          </Link>
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight">Lesson video</h1>
        <p className="mt-2 text-muted-foreground">
          Attach an external video URL or upload a direct MP4/WebM file to R2.
        </p>
      </div>
      {databaseMissing ? (
        <SetupMessage
          title="Supabase setup required"
          items={[
            "Lesson video metadata saves require DATABASE_URL and DIRECT_URL.",
            "R2 uploads also require the Cloudflare R2 env group.",
          ]}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{lesson?.title ?? "Video attachment"}</CardTitle>
        </CardHeader>
        <CardContent>
          {!databaseMissing && !allowed ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Instructor or admin access is required to manage this lesson
              video.
            </p>
          ) : (
            <LessonVideoForm
              action={updateLessonVideoFormAction.bind(
                null,
                courseId,
                lessonId,
              )}
              disabled={databaseMissing || !allowed}
              defaults={{
                videoUrl: lesson?.videoUrl ?? "",
                videoProvider: lesson?.videoProvider ?? "EXTERNAL",
                videoAssetKey: lesson?.videoAssetKey ?? "",
                videoMimeType: lesson?.videoMimeType ?? "",
                videoBytes: lesson?.videoBytes ?? "",
              }}
            />
          )}
        </CardContent>
      </Card>
      {playback ? (
        <Card>
          <CardHeader>
            <CardTitle>Current video</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {lesson?.videoProvider ?? "EXTERNAL"} ·{" "}
              {formatVideoBytes(lesson?.videoBytes)}
            </p>
            {playback.kind === "video" ? (
              <video
                controls
                className="aspect-video w-full rounded-md border bg-black"
                src={playback.src}
              />
            ) : (
              <iframe
                className="aspect-video w-full rounded-md border"
                src={playback.src}
                title={playback.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
