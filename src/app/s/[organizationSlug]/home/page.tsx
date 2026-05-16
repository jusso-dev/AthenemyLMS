import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpenCheck, GraduationCap } from "lucide-react";
import { getCurrentAppUser } from "@/lib/auth";
import {
  getPublishedPortal,
  getPortalCourses,
  publishedTheme,
} from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { PortalShell } from "@/components/portal/portal-renderer";

export default async function PortalLearnerHomePage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const [organization, user] = await Promise.all([
    getPublishedPortal(organizationSlug),
    getCurrentAppUser(),
  ]);
  if (!organization?.portal || organization.portal.status !== "PUBLISHED") {
    notFound();
  }

  const enrollments = user
    ? await prisma.enrollment.findMany({
        where: {
          userId: user.id,
          status: { in: ["ACTIVE", "COMPLETED"] },
          course: { organizationId: organization.id },
        },
        include: {
          course: {
            include: {
              sections: {
                include: {
                  lessons: { select: { id: true, title: true } },
                },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];
  const lessonIds = enrollments.flatMap((enrollment) =>
    enrollment.course.sections.flatMap((section) =>
      section.lessons.map((lesson) => lesson.id),
    ),
  );
  const progress =
    user && lessonIds.length
      ? await prisma.lessonProgress.findMany({
          where: {
            userId: user.id,
            lessonId: { in: lessonIds },
            completedAt: { not: null },
          },
          select: { lessonId: true },
        })
      : [];
  const completedLessonIds = new Set(progress.map((item) => item.lessonId));
  const availableCourses = await getPortalCourses(organization.id, 3);

  return (
    <PortalShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      theme={publishedTheme(organization.portal)}
      signedIn={Boolean(user)}
    >
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">
            Continue learning
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Resume enrolled courses, review progress, or find the next course.
          </p>
        </div>

        {!user ? (
          <Card className="mt-8">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Sign in to see your learner home</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your courses, certificates, and required work appear after
                  sign-in.
                </p>
              </div>
              <Button asChild>
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {user && enrollments.length > 0 ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {enrollments.map((enrollment) => {
              const lessons = enrollment.course.sections.flatMap(
                (section) => section.lessons,
              );
              const completed = lessons.filter((lesson) =>
                completedLessonIds.has(lesson.id),
              ).length;
              const nextLesson =
                lessons.find((lesson) => !completedLessonIds.has(lesson.id)) ??
                lessons[0];
              const percent = lessons.length
                ? Math.round((completed / lessons.length) * 100)
                : 0;

              return (
                <Card key={enrollment.id}>
                  <CardHeader>
                    <CardTitle>{enrollment.course.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Progress value={percent} />
                    <p className="text-sm text-muted-foreground">
                      {completed} of {lessons.length} lessons complete
                    </p>
                    <Button asChild>
                      <Link
                        href={
                          nextLesson
                            ? `/dashboard/learn/${enrollment.courseId}/lessons/${nextLesson.id}`
                            : `/dashboard/learn/${enrollment.courseId}`
                        }
                      >
                        Resume course
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : user ? (
          <EmptyState
            icon={BookOpenCheck}
            title="No enrolled courses"
            description="Choose a course from this portal to start learning."
            className="mt-8"
          />
        ) : null}

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Available courses</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {availableCourses.map((course) => (
              <Card key={course.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{course.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {course.subtitle}
                  </p>
                  <Button asChild variant="outline">
                    <Link
                      href={`/s/${organization.slug}/courses/${course.slug}`}
                    >
                      View course
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          {availableCourses.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No published courses"
              description="Published courses will appear here."
              className="mt-5"
            />
          ) : null}
        </section>
      </main>
    </PortalShell>
  );
}
