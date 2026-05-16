import Link from "next/link";
import { Award, CheckCircle2, ClipboardCheck, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { getCurrentAppUser } from "@/lib/auth";
import {
  databaseIsConfigured,
  fallbackNotice,
  getLearnCourse,
} from "@/lib/dashboard-data";
import { prisma } from "@/lib/prisma";
import { SetupMessage } from "@/lib/setup-message";

export default async function LearnCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const user = await getCurrentAppUser();
  const { mode, course, completedLessonIds } = await getLearnCourse(user, courseId);
  const completedIds: string[] = completedLessonIds;
  const lessons = course?.sections.flatMap((section) => section.lessons) ?? [];
  const firstIncompleteLesson =
    lessons.find((lesson) => !completedIds.includes(lesson.id)) ?? lessons[0];
  const progressPercent = lessons.length
    ? Math.round((completedIds.length / lessons.length) * 100)
    : 0;
  const assessments =
    mode !== "permission" && databaseIsConfigured()
      ? await prisma.assessment.findMany({
          where: { courseId },
          orderBy: { createdAt: "desc" },
        })
      : [];

  return (
    <div className="space-y-6">
      {mode === "fallback" ? <SetupMessage {...fallbackNotice()} /> : null}
      <PageHeader
        title={course?.title ?? "Course access"}
        description="Resume where you left off, review the curriculum, and keep required work visible."
        actions={
          firstIncompleteLesson ? (
            <Button asChild>
              <Link
                href={`/dashboard/learn/${course?.id}/lessons/${firstIncompleteLesson.id}`}
              >
                Resume lesson
              </Link>
            </Button>
          ) : null
        }
      />
      {course ? (
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Course progress</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {completedIds.length} of {lessons.length} lessons complete
              </p>
            </div>
            <div className="w-full sm:max-w-sm">
              <Progress value={progressPercent} />
              <p className="mt-2 text-right text-xs font-medium text-muted-foreground">
                {progressPercent}%
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Lessons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "permission" ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Enroll in this course to access lessons.
            </p>
          ) : null}
          {mode !== "permission" && !course ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Course not found.
            </p>
          ) : null}
          {course?.sections.length === 0 ? (
            <EmptyState
              icon={PlayCircle}
              title="No lessons yet"
              description="This course has been created, but the instructor has not added lessons yet."
            />
          ) : null}
          {course?.sections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 text-sm font-semibold">{section.title}</p>
              <div className="space-y-2">
                {section.lessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/dashboard/learn/${course.id}/lessons/${lesson.id}`}
                    className="flex items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted"
                  >
                    <PlayCircle className="h-4 w-4 text-primary" />
                    {lesson.title}
                    {completedIds.includes(lesson.id) ? (
                      <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-secondary" />
                        Complete
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Button asChild variant="outline">
        <Link href={`/dashboard/learn/${courseId}/certificate`}>
          <Award className="h-4 w-4" />
          Course certificate
        </Link>
      </Button>
      {assessments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Assessments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {assessments.map((assessment) => (
              <Link
                key={assessment.id}
                href={`/dashboard/learn/${courseId}/assessments/${assessment.id}`}
                className="flex items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted"
              >
                <ClipboardCheck className="h-4 w-4 text-primary" />
                {assessment.title}
                {assessment.requiredForCompletion ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Required
                  </span>
                ) : null}
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
