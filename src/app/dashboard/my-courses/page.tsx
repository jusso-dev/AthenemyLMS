import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { mockCourses } from "@/lib/mock-data";

export default function MyCoursesPage() {
  return (
    <div className="space-y-8">
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
        {mockCourses.slice(0, 2).map((course) => (
          <CourseCard key={course.slug} course={course} />
        ))}
      </div>
    </div>
  );
}
