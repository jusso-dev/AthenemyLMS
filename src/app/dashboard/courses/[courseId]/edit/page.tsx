import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseForm } from "@/components/forms/course-form";
import { updateCourseAction } from "@/app/dashboard/courses/actions";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackNotice, getEditableCourse } from "@/lib/dashboard-data";
import { SetupMessage } from "@/lib/setup-message";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const user = await getCurrentAppUser();
  const { mode, course } = await getEditableCourse(user, courseId);
  if (!course && mode !== "permission") notFound();

  return (
    <div className="max-w-3xl space-y-6">
      {mode === "fallback" ? <SetupMessage {...fallbackNotice()} /> : null}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Edit course</h1>
          <p className="mt-2 text-muted-foreground">
            {course?.title ?? "Permission required"}
          </p>
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
          {mode === "permission" || !course ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Instructor or admin access is required to edit this course.
            </p>
          ) : (
            <CourseForm
              action={updateCourseAction.bind(null, course.id)}
              disabled={mode === "fallback"}
              defaults={{
                title: course.title,
                slug: course.slug,
                subtitle: course.subtitle ?? "",
                description: course.description ?? "",
                priceCents: course.priceCents,
                status: course.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
                thumbnailUrl:
                  "thumbnailUrl" in course ? (course.thumbnailUrl ?? "") : "",
              }}
              submitLabel={mode === "fallback" ? "Configure Supabase to save" : "Save course"}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
