import { Search } from "lucide-react";
import { CourseCard } from "@/components/course-card";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Input } from "@/components/ui/input";
import { getPublishedCourses } from "@/lib/course-data";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const courses = await getPublishedCourses(params.q);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">
              Course catalogue
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Browse published Athenemy courses. Local mock courses appear until
              Supabase is connected.
            </p>
          </div>
          <form className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search courses"
              type="search"
              name="q"
              placeholder="Search courses"
              className="pl-9"
            />
          </form>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.slug} course={course} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
