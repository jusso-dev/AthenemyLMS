import Link from "next/link";
import { Award, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockCourses } from "@/lib/mock-data";

export default async function LearnCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = mockCourses.find((item) => item.id === courseId) ?? mockCourses[0];
  const firstLesson = course.sections[0]?.lessons[0];

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
      <Button asChild variant="outline">
        <Link href={`/dashboard/learn/${courseId}/certificate`}>
          <Award className="h-4 w-4" />
          Course certificate
        </Link>
      </Button>
    </div>
  );
}
