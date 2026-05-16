import { CourseForm } from "@/components/forms/course-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCourseFormAction } from "@/app/dashboard/courses/actions";
import { missingEnv } from "@/lib/env";
import { SetupMessage } from "@/lib/setup-message";

export default async function NewCoursePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const needsSetup = missingEnv(["DATABASE_URL"]).length > 0;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="New course"
        description="Draft the core course details. Curriculum, learners, assessments, and publishing controls are available after the course exists."
      />
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
          <CourseForm
            stateAction={createCourseFormAction}
            initialError={params.error}
          />
        </CardContent>
      </Card>
    </div>
  );
}
