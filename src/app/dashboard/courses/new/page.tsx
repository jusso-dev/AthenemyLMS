import { CourseForm } from "@/components/forms/course-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCourseAction } from "@/app/dashboard/courses/actions";
import { missingEnv } from "@/lib/env";
import { SetupMessage } from "@/lib/setup-message";

export default function NewCoursePage() {
  const needsSetup = missingEnv(["DATABASE_URL"]).length > 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">New course</h1>
        <p className="mt-2 text-muted-foreground">
          Draft the core course details. Curriculum, students, and publishing
          controls are available after the course exists.
        </p>
      </div>
      {needsSetup ? (
        <SetupMessage
          title="Database setup required for saving"
          items={[
            "Add DATABASE_URL and DIRECT_URL to .env.local.",
            "Run npx prisma migrate dev after Supabase is configured.",
          ]}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Course details</CardTitle>
        </CardHeader>
        <CardContent>
          <CourseForm action={createCourseAction} />
        </CardContent>
      </Card>
    </div>
  );
}
