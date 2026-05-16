import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, LibraryBig, PlayCircle } from "lucide-react";
import { getCurrentAppUser } from "@/lib/auth";
import {
  getPublishedPortal,
  portalPublishedCourseWhere,
  publishedTheme,
} from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PortalShell } from "@/components/portal/portal-renderer";
import { formatPrice } from "@/lib/utils";

export default async function PortalCoursePage({
  params,
}: {
  params: Promise<{ organizationSlug: string; courseSlug: string }>;
}) {
  const { organizationSlug, courseSlug } = await params;
  const [organization, user] = await Promise.all([
    getPublishedPortal(organizationSlug),
    getCurrentAppUser(),
  ]);
  if (!organization?.portal || organization.portal.status !== "PUBLISHED") {
    notFound();
  }

  const course = await prisma.course.findFirst({
    where: {
      ...portalPublishedCourseWhere(organization.id),
      slug: courseSlug,
    },
    include: {
      instructor: { select: { name: true, imageUrl: true } },
      sections: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            select: { id: true, title: true, position: true },
          },
        },
      },
    },
  });
  if (!course) notFound();

  const enrollment = user
    ? await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
      })
    : null;
  const lessonCount = course.sections.reduce(
    (total, section) => total + section.lessons.length,
    0,
  );

  return (
    <PortalShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      theme={publishedTheme(organization.portal)}
      signedIn={Boolean(user)}
    >
      <main>
        <section className="border-b bg-card">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
            <div>
              <Badge variant="gold">{course.level}</Badge>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight">
                {course.title}
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
                {course.description || course.subtitle}
              </p>
              <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>
                  Instructor: {course.instructor?.name ?? "Athenemy faculty"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {Math.max(1, Math.round(course.durationMinutes / 60))} hours
                </span>
                <span>{lessonCount} lessons</span>
              </div>
            </div>
            <Card className="h-fit lg:sticky lg:top-24">
              <CardHeader>
                <CardTitle className="text-3xl">
                  {formatPrice(course.priceCents, course.currency)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild className="w-full" size="lg">
                  <Link
                    href={
                      user
                        ? `/dashboard/learn/${course.id}`
                        : `/sign-in?redirect_url=/s/${organization.slug}/courses/${course.slug}`
                    }
                  >
                    {enrollment
                      ? "Continue course"
                      : user
                        ? "Start course"
                        : "Sign in to enroll"}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/s/${organization.slug}/courses`}>
                    Back to catalogue
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold">Curriculum</h2>
          <div className="mt-6 space-y-4">
            {course.sections.length === 0 ? (
              <EmptyState
                icon={LibraryBig}
                title="Curriculum coming soon"
                description="This course is published, but lesson details have not been added yet."
              />
            ) : null}
            {course.sections.map((section) => (
              <Card key={section.id}>
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
    </PortalShell>
  );
}
