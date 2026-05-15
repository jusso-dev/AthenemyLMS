import Link from "next/link";
import { ClipboardCheck, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockCourses } from "@/lib/mock-data";
import { missingEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export default async function LearnCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = mockCourses.find((item) => item.id === courseId) ?? mockCourses[0];
  const firstLesson = course.sections[0]?.lessons[0];
  const assessments =
    missingEnv(["DATABASE_URL"]).length === 0
      ? await prisma.assessment.findMany({
          where: { courseId },
          orderBy: { createdAt: "desc" },
        })
      : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{course.title}</h1>
          <p className="mt-2 text-muted-foreground">
            Resume where you left off and keep progress visible.
          </p>
        </div>
        {firstLesson ? (
          <Button asChild>
            <Link href={`/dashboard/learn/${course.id}/lessons/${firstLesson.id}`}>
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
          {course.sections.map((section) => (
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
