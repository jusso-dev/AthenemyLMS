import Link from "next/link";
import { ClipboardCheck, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const firstLesson = course?.sections[0]?.lessons[0];
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {course?.title ?? "Course access"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Resume where you left off and keep progress visible.
          </p>
        </div>
        {firstLesson ? (
          <Button asChild>
            <Link href={`/dashboard/learn/${course?.id}/lessons/${firstLesson.id}`}>
              Resume lesson
            </Link>
          </Button>
        ) : null}
      </div>
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
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Lessons have not been added yet.
            </p>
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
                      <span className="ml-auto text-xs text-muted-foreground">
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
