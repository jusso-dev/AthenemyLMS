import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichLessonEditor } from "@/components/forms/rich-lesson-editor";
import { SetupMessage } from "@/lib/setup-message";
import { missingEnv } from "@/lib/env";
import { getCurrentAppUser } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { updateLessonContentAction } from "@/app/dashboard/courses/actions";

export default async function EditLessonPage({
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

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="outline" size="sm" className="mb-4">
            <Link href={`/dashboard/courses/${courseId}/curriculum`}>
              <ArrowLeft className="h-4 w-4" />
              Curriculum
            </Link>
          </Button>
          <h1 className="text-3xl font-semibold tracking-tight">Lesson editor</h1>
          <p className="mt-2 text-muted-foreground">
            Write Markdown content and preview the learner-facing lesson body.
          </p>
        </div>
      </div>
      {databaseMissing ? (
        <SetupMessage
          title="Supabase setup required"
          items={[
            "Lesson content saves require DATABASE_URL and DIRECT_URL.",
            "Configure Supabase, run migrations, then edit persisted lessons.",
          ]}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{lesson?.title ?? "Lesson content"}</CardTitle>
        </CardHeader>
        <CardContent>
          {!databaseMissing && !allowed ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Instructor or admin access is required to edit this lesson.
            </p>
          ) : (
            <RichLessonEditor
              action={updateLessonContentAction.bind(null, courseId, lessonId)}
              disabled={databaseMissing || !allowed}
              defaults={{
                title: lesson?.title ?? "",
                slug: lesson?.slug ?? "",
                content: lesson?.content ?? "",
                videoUrl: lesson?.videoUrl ?? "",
                durationMinutes: lesson?.durationMinutes ?? 0,
                preview: lesson?.preview ?? false,
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
