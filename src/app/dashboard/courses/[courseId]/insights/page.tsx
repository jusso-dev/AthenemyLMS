import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, Download } from "lucide-react";
import { CourseManagementNav } from "@/components/courses/course-management-nav";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { getCurrentAppUser } from "@/lib/auth";
import { missingEnv } from "@/lib/env";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { SetupMessage } from "@/lib/setup-message";
import { getLearnerRiskSignal } from "@/lib/analytics";

export default async function CourseInsightsPage({
  searchParams,
  params,
}: {
  searchParams: Promise<{
    status?: string | string[];
    assessment?: string | string[];
  }>;
  params: Promise<{ courseId: string }>;
}) {
  const query = await searchParams;
  const statusParam = Array.isArray(query.status)
    ? query.status[0]
    : query.status;
  const assessmentParam = Array.isArray(query.assessment)
    ? query.assessment[0]
    : query.assessment;
  const status: string = ["complete", "active", "at-risk"].includes(
    statusParam ?? "",
  )
    ? (statusParam ?? "all")
    : "all";
  const assessmentStatus: string = [
    "passed",
    "needs-review",
    "no-submission",
  ].includes(assessmentParam ?? "")
    ? (assessmentParam ?? "all")
    : "all";
  const { courseId } = await params;
  const insightsHref = (next: {
    status?: string;
    assessmentStatus?: string;
  }) => {
    const params = new URLSearchParams();
    const nextStatus = next.status ?? status;
    const nextAssessment = next.assessmentStatus ?? assessmentStatus;

    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextAssessment !== "all") {
      params.set("assessment", nextAssessment);
    }

    const search = params.toString();
    return `/dashboard/courses/${courseId}/insights${search ? `?${search}` : ""}`;
  };
  const databaseMissing = missingEnv(["DATABASE_URL"]).length > 0;
  const user = await getCurrentAppUser();
  const course = databaseMissing
    ? null
    : await prisma.course.findUnique({
        where: { id: courseId },
        include: {
          sections: {
            include: {
              lessons: {
                orderBy: { position: "asc" },
                select: { id: true, title: true },
              },
            },
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
          select: { userId: true, lessonId: true, lastSeenAt: true },
          orderBy: { lastSeenAt: "desc" },
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
      const lastActivityAt =
        progress.find((item) => item.userId === enrollment.userId)
          ?.lastSeenAt ?? enrollment.updatedAt;
      const failedRequiredAssessments = course.assessments
        .filter((assessment) => assessment.requiredForCompletion)
        .flatMap((assessment) =>
          assessment.submissions.filter(
            (submission) =>
              submission.userId === enrollment.userId && !submission.passed,
          ),
        ).length;
      const risk = getLearnerRiskSignal({
        progressPercent: lessonIds.length
          ? Math.round((completedLessons / lessonIds.length) * 100)
          : 0,
        enrolledAt: enrollment.createdAt,
        lastActivityAt,
        failedRequiredAssessments,
      });

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
        risk,
      };
    }) ?? [];
  const filteredLearnerRows = learnerRows.filter((row) => {
    const matchesStatus =
      status === "complete"
        ? row.progress === 100
        : status === "active"
          ? row.progress > 0 && row.progress < 100
          : status === "at-risk"
            ? row.progress < 50
            : true;
    const matchesAssessment =
      assessmentStatus === "passed"
        ? row.totalSubmissions > 0 &&
          row.passedAssessments === row.totalSubmissions
        : assessmentStatus === "needs-review"
          ? row.totalSubmissions > 0 &&
            row.passedAssessments < row.totalSubmissions
          : assessmentStatus === "no-submission"
            ? row.totalSubmissions === 0
            : true;
    return matchesStatus && matchesAssessment;
  });
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
  const atRiskCount = learnerRows.filter(
    (row) => row.risk.level !== "low",
  ).length;
  const lessonEngagement =
    course?.sections.flatMap((section) =>
      section.lessons.map((lesson) => {
        const completions = progress.filter(
          (item) => item.lessonId === lesson.id,
        ).length;
        return {
          id: lesson.id,
          title: lesson.title,
          completions,
          rate: learnerRows.length
            ? Math.round((completions / learnerRows.length) * 100)
            : 0,
        };
      }),
    ) ?? [];

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
        actions={
          course && allowed ? (
            <Button asChild variant="outline">
              <Link href={`/api/courses/${course.id}/reports/completions`}>
                <Download className="h-4 w-4" />
                Export CSV
              </Link>
            </Button>
          ) : null
        }
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
              { label: "At risk", value: atRiskCount },
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
              <CardTitle>Lesson engagement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lessonEngagement.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No lesson engagement yet"
                  description="Lesson completion data will appear once learners start progressing."
                />
              ) : null}
              {lessonEngagement.map((lesson) => (
                <div
                  key={lesson.id}
                  className="grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_180px_90px]"
                >
                  <p className="font-medium">{lesson.title}</p>
                  <div>
                    <Progress value={lesson.rate} />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {lesson.completions}/{learnerRows.length} learners
                    </p>
                  </div>
                  <p className="text-sm font-medium">{lesson.rate}%</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gradebook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3 border-b pb-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "All progress", value: "all" },
                    { label: "Complete", value: "complete" },
                    { label: "Active", value: "active" },
                    { label: "At risk", value: "at-risk" },
                  ].map((item) => {
                    const active = status === item.value;
                    return (
                      <Button
                        key={item.value}
                        asChild
                        variant={active ? "secondary" : "ghost"}
                        size="sm"
                      >
                        <Link href={insightsHref({ status: item.value })}>
                          {item.label}
                        </Link>
                      </Button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "All assessments", value: "all" },
                    { label: "Passed", value: "passed" },
                    { label: "Needs review", value: "needs-review" },
                    { label: "No submission", value: "no-submission" },
                  ].map((item) => {
                    const active = assessmentStatus === item.value;
                    return (
                      <Button
                        key={item.value}
                        asChild
                        variant={active ? "secondary" : "ghost"}
                        size="sm"
                      >
                        <Link
                          href={insightsHref({
                            assessmentStatus: item.value,
                          })}
                        >
                          {item.label}
                        </Link>
                      </Button>
                    );
                  })}
                </div>
              </div>
              {filteredLearnerRows.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title={
                    learnerRows.length === 0
                      ? "No learner data yet"
                      : "No learners match these filters"
                  }
                  description={
                    learnerRows.length === 0
                      ? "Enroll learners and collect lesson progress or assessment submissions to populate this report."
                      : "Adjust the progress or assessment filters to expand this report."
                  }
                />
              ) : null}
              <div className="hidden rounded-md border bg-muted/40 px-3 py-2 text-xs font-medium uppercase text-muted-foreground lg:grid lg:grid-cols-[1fr_180px_150px_130px]">
                <span>Learner</span>
                <span>Progress</span>
                <span>Assessments</span>
                <span>Certificate</span>
              </div>
              {filteredLearnerRows.map((row) => (
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
                      {row.averageScore === null
                        ? "No score"
                        : `${row.averageScore}%`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.passedAssessments}/{row.totalSubmissions} passed
                    </p>
                  </div>
                  <Badge
                    variant={
                      row.risk.level === "high"
                        ? "outline"
                        : row.certificate
                          ? "success"
                          : "outline"
                    }
                    className="w-fit"
                  >
                    {row.certificate ? "Issued" : row.risk.label}
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
