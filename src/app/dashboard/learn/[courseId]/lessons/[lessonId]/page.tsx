import Link from "next/link";
import { CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockCourses } from "@/lib/mock-data";

export default async function LessonPlayerPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const course = mockCourses.find((item) => item.id === courseId) ?? mockCourses[0];
  const lessons = course.sections.flatMap((section) => section.lessons);
  const lesson = lessons.find((item) => item.id === lessonId) ?? lessons[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-5">
        <div className="aspect-video rounded-lg border bg-[linear-gradient(135deg,var(--primary),var(--secondary))] p-8 text-primary-foreground">
          <p className="text-sm font-medium opacity-80">Lesson player</p>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold">{lesson.title}</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Lesson notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
            <p>
              This lesson content area supports rich text, embedded video URLs,
              uploaded resources, and progress events. The MVP page is ready for
              persisted lesson content once Supabase is configured.
            </p>
            <Button>
              <CheckCircle2 className="h-4 w-4" />
              Mark complete
            </Button>
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
                href={`/dashboard/learn/${course.id}/lessons/${item.id}`}
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
          <CardContent>
            <Button variant="outline" className="w-full justify-start">
              <Download className="h-4 w-4" />
              Example workbook
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
