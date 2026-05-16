import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { CourseCard } from "@/components/course-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackNotice, getMyCourses } from "@/lib/dashboard-data";
import { SetupMessage } from "@/lib/setup-message";

export default async function MyCoursesPage() {
  const user = await getCurrentAppUser();
  const { mode, courses } = await getMyCourses(user);

  return (
    <div className="space-y-8">
      {mode === "fallback" ? <SetupMessage {...fallbackNotice()} /> : null}
      <PageHeader
        title="My courses"
        description="Your enrolled courses, resume points, and completion progress."
        actions={
          <Button asChild variant="outline">
            <Link href="/courses">Find courses</Link>
          </Button>
        }
      />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {mode === "permission" ? (
          <p className="rounded-md border p-4 text-sm text-muted-foreground md:col-span-2 lg:col-span-3">
            Sign in to view enrolled courses.
          </p>
        ) : null}
        {mode !== "permission" && courses.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No enrollments yet"
            description="Browse the catalogue and enroll in a course to start learning."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/courses">Browse catalogue</Link>
              </Button>
            }
            className="md:col-span-2 lg:col-span-3"
          />
        ) : null}
        {courses.map((course) => (
          <CourseCard key={course.slug} course={course} />
        ))}
      </div>
    </div>
  );
}
