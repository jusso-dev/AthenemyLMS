import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { CourseManagementNav } from "@/components/courses/course-management-nav";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { getCurrentAppUser } from "@/lib/auth";
import { missingEnv } from "@/lib/env";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { SetupMessage } from "@/lib/setup-message";

export default async function CourseInsightsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const databaseMissing = missingEnv(["DATABASE_URL"]).length > 0;
  const user = await getCurrentAppUser();
  const course = databaseMissing
    ? null
    : await prisma.course.findUnique({
        where: { id: courseId },
        include: {
          sections: {
            include: { lessons: { select: { id: true } } },
          },
          enrollments: {
            where: { status: { in: ["ACTIVE", "COMPLETED"] } },
            include: { user: true },
            orderBy: { updatedAt: "desc" },
          },
          assessments: {
            include: { submissions: true },
          },
          certificates: true,
          payments: { where: { status: "PAID" } },
        },
      });

  if (!databaseMissing && !course) notFound();

  const allowed = course ? canManageCourse(user, course) : false;
  const lessonIds =
    course?.sections.flatMap((section) =>
      section.lessons.map((lesson) => lesson.id),
    ) ?? [];
  const enrollmentUserIds =
    course?.enrollments.map((enrollment) => enrollment.userId) ?? [];
  const progress =
    allowed && lessonIds.length
      ? await prisma.lessonProgress.findMany({
          where: {
            lessonId: { in: lessonIds },
            completedAt: { not: null },
            userId: {
              in: enrollmentUserIds,
            },
          },
          select: { userId: true, lessonId: true },
        })
      : [];
  const totalRevenue = course
    ? course.payments.reduce((total, payment) => total + payment.amountCents, 0)
    : 0;
  const learnerRows =
    course?.enrollments.map((enrollment) => {
      const completedLessons = progress.filter(
        (item) => item.userId === enrollment.userId,
      ).length;
      const submissions = course.assessments.flatMap((assessment) =>
        assessment.submissions.filter(
          (submission) => submission.userId === enrollment.userId,
        ),
      );
      const averageScore = submissions.length
        ? Math.round(
            submissions.reduce(
              (total, submission) => total + submission.score,
              0,
            ) / submissions.length,
          )
        : null;
      const certificate = course.certificates.find(
        (item) => item.userId === enrollment.userId,
      );

      return {
        user: enrollment.user,
        progress: lessonIds.length
          ? Math.round((completedLessons / lessonIds.length) * 100)
          : 0,
        completedLessons,
        averageScore,
        passedAssessments: submissions.filter((submission) => submission.passed)
          .length,
        totalSubmissions: submissions.length,
        certificate,
      };
    }) ?? [];
  const completionRate = learnerRows.length
    ? Math.round(
        (learnerRows.filter((row) => row.progress === 100).length /
          learnerRows.length) *
          100,
      )
    : 0;
  const averageAssessmentScore = learnerRows.filter(
    (row) => row.averageScore !== null,
  ).length
    ? Math.round(
        learnerRows.reduce((total, row) => total + (row.averageScore ?? 0), 0) /
          learnerRows.filter((row) => row.averageScore !== null).length,
      )
    : 0;

  return (
    <div className="space-y-6">
      {databaseMissing ? (
        <SetupMessage
          title="Supabase setup required"
          items={["Course reporting requires DATABASE_URL and DIRECT_URL."]}
        />
      ) : null}
      <PageHeader
        eyebrow={course?.title}
        title="Insights"
        description="Gradebook-style progress, assessment, certificate, and revenue reporting."
      />
      <CourseManagementNav courseId={courseId} />
      {!allowed ? (
        <Card>
          <CardContent className="pt-6">
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Instructor or admin access is required to view course insights.
            </p>
          </CardContent>
        </Card>
      ) : null}
      {course && allowed ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Learners", value: learnerRows.length },
              { label: "Completion rate", value: `${completionRate}%` },
              { label: "Avg. score", value: `${averageAssessmentScore}%` },
              { label: "Revenue", value: formatPrice(totalRevenue) },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Gradebook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {learnerRows.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No learner data yet"
                  description="Enroll learners and collect lesson progress or assessment submissions to populate this report."
                />
              ) : null}
              <div className="hidden rounded-md border bg-muted/40 px-3 py-2 text-xs font-medium uppercase text-muted-foreground lg:grid lg:grid-cols-[1fr_180px_150px_130px]">
                <span>Learner</span>
                <span>Progress</span>
                <span>Assessments</span>
                <span>Certificate</span>
              </div>
              {learnerRows.map((row) => (
                <div
                  key={row.user.id}
                  className="grid gap-3 rounded-md border p-4 lg:grid-cols-[1fr_180px_150px_130px]"
                >
                  <div>
                    <p className="font-medium">
                      {row.user.name ?? "Unnamed learner"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {row.user.email}
                    </p>
                  </div>
                  <div>
                    <Progress value={row.progress} />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {row.completedLessons}/{lessonIds.length} lessons ·{" "}
                      {row.progress}%
                    </p>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">
                      {row.averageScore === null ? "No score" : `${row.averageScore}%`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.passedAssessments}/{row.totalSubmissions} passed
                    </p>
                  </div>
                  <Badge
                    variant={row.certificate ? "success" : "outline"}
                    className="w-fit"
                  >
                    {row.certificate ? "Issued" : "Pending"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
