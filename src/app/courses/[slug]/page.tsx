import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, PlayCircle } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCourseBySlug } from "@/lib/course-data";
import { formatPrice } from "@/lib/utils";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="border-b bg-card">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
            <div>
              <Badge variant="gold">{course.level}</Badge>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight">
                {course.title}
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
                {course.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>Instructor: {course.instructor?.name ?? "Athenemy faculty"}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {Math.round(course.durationMinutes / 60)} hours
                </span>
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl">
                  {formatPrice(course.priceCents, course.currency)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild className="w-full" size="lg">
                  <Link href={`/dashboard/learn/${course.id}`}>
                    {course.priceCents === 0 ? "Enroll free" : "Buy course"}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/dashboard">Preview in dashboard</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold">Curriculum</h2>
          <div className="mt-6 space-y-4">
            {course.sections.map((section) => (
              <Card key={section.title}>
                <CardHeader>
                  <CardTitle>{section.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {section.lessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="flex items-center gap-3 rounded-md border p-3 text-sm"
                    >
                      <PlayCircle className="h-4 w-4 text-primary" />
                      {lesson.title}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
