import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackNotice, getMyCourses } from "@/lib/dashboard-data";
import { SetupMessage } from "@/lib/setup-message";

export default async function MyCoursesPage() {
  const user = await getCurrentAppUser();
  const { mode, courses } = await getMyCourses(user);

  return (
    <div className="space-y-8">
      {mode === "fallback" ? <SetupMessage {...fallbackNotice()} /> : null}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My courses</h1>
          <p className="mt-2 text-muted-foreground">
            Enrolled courses and resume points for the current learner.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/courses">Find courses</Link>
        </Button>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {mode === "permission" ? (
          <p className="rounded-md border p-4 text-sm text-muted-foreground md:col-span-2 lg:col-span-3">
            Sign in to view enrolled courses.
          </p>
        ) : null}
        {mode !== "permission" && courses.length === 0 ? (
          <p className="rounded-md border p-4 text-sm text-muted-foreground md:col-span-2 lg:col-span-3">
            You are not enrolled in any courses yet.
          </p>
        ) : null}
        {courses.map((course) => (
          <CourseCard key={course.slug} course={course} />
        ))}
      </div>
    </div>
  );
}
