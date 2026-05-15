import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseForm } from "@/components/forms/course-form";
import { createCourseAction } from "@/app/dashboard/courses/actions";
import { mockCourses } from "@/lib/mock-data";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = mockCourses.find((item) => item.id === courseId) ?? mockCourses[0];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Edit course</h1>
          <p className="mt-2 text-muted-foreground">{course.title}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/dashboard/courses/${courseId}/curriculum`}>
              Curriculum
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dashboard/courses/${courseId}/students`}>Students</Link>
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Course details</CardTitle>
        </CardHeader>
        <CardContent>
          <CourseForm
            action={createCourseAction}
            defaults={{
              title: course.title,
              slug: course.slug,
              subtitle: course.subtitle,
              description: course.description,
              priceCents: course.priceCents,
              status: "PUBLISHED",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
