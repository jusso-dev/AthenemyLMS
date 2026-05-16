import Link from "next/link";
import { Award, BookOpen, ClipboardCheck, GraduationCap, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackNotice, getMyCourses } from "@/lib/dashboard-data";
import { SetupMessage } from "@/lib/setup-message";

export default async function MyCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const params = await searchParams;
  const statusParam = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  const status = ["active", "completed"].includes(statusParam ?? "")
    ? statusParam
    : "all";
  const user = await getCurrentAppUser();
  const { mode, courses, summary } = await getMyCourses(user);
  const filteredCourses = courses.filter((item) => {
    if (status === "active") return item.progressPercent < 100;
    if (status === "completed") return item.progressPercent === 100;
    return true;
  });

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
      {mode === "database" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Active courses", value: summary.activeCourses },
            { label: "Completed", value: summary.completedCourses },
            { label: "Required work", value: summary.requiredWork },
            { label: "Certificates", value: summary.certificatesEarned },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {mode === "database" ? (
        <div className="flex gap-2 overflow-x-auto border-b pb-3">
          {[
            { href: "/dashboard/my-courses", label: "All" },
            { href: "/dashboard/my-courses?status=active", label: "Active" },
            {
              href: "/dashboard/my-courses?status=completed",
              label: "Completed",
            },
          ].map((item) => {
            const active =
              (status === "all" && item.label === "All") ||
              status === item.label.toLowerCase();
            return (
              <Button
                key={item.href}
                asChild
                variant={active ? "secondary" : "ghost"}
                size="sm"
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            );
          })}
        </div>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-2">
        {mode === "permission" ? (
          <p className="rounded-md border p-4 text-sm text-muted-foreground lg:col-span-2">
            Sign in to view enrolled courses.
          </p>
        ) : null}
        {mode !== "permission" && filteredCourses.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={
              courses.length === 0
                ? "No enrollments yet"
                : "No courses in this view"
            }
            description={
              courses.length === 0
                ? "Browse the catalogue and enroll in a course to start learning."
                : "Switch filters to see the rest of your enrolled courses."
            }
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/courses">Browse catalogue</Link>
              </Button>
            }
            className="lg:col-span-2"
          />
        ) : null}
        {filteredCourses.map((item) => (
          <Card key={item.course.id} className="flex h-full flex-col">
            <CardHeader className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="leading-snug">
                    {item.course.title}
                  </CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.course.instructor?.name ?? "Athenemy faculty"} ·{" "}
                    enrolled{" "}
                    {item.enrolledAt.toLocaleDateString("en", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <Badge
                  variant={
                    item.progressPercent === 100 ? "success" : "secondary"
                  }
                >
                  {item.progressPercent === 100 ? "Complete" : "Active"}
                </Badge>
              </div>
              <div>
                <Progress value={item.progressPercent} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.completedLessons} of {item.totalLessons} lessons
                  complete · {item.progressPercent}%
                </p>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-md border bg-muted/25 p-3">
                  <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
                  <p className="mt-2 font-medium">{item.totalLessons}</p>
                  <p className="text-xs text-muted-foreground">Lessons</p>
                </div>
                <div className="rounded-md border bg-muted/25 p-3">
                  <ClipboardCheck
                    className="h-4 w-4 text-primary"
                    aria-hidden="true"
                  />
                  <p className="mt-2 font-medium">
                    {item.completedRequiredAssessments}/
                    {item.requiredAssessments}
                  </p>
                  <p className="text-xs text-muted-foreground">Required</p>
                </div>
                <div className="rounded-md border bg-muted/25 p-3">
                  <Award className="h-4 w-4 text-primary" aria-hidden="true" />
                  <p className="mt-2 font-medium">
                    {item.certificateNumber ? "Earned" : "Pending"}
                  </p>
                  <p className="text-xs text-muted-foreground">Certificate</p>
                </div>
              </div>
              {item.nextLesson ? (
                <div className="rounded-md border p-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Next lesson
                  </p>
                  <p className="mt-1 font-medium">{item.nextLesson.title}</p>
                </div>
              ) : null}
              <div className="mt-auto flex flex-wrap gap-2">
                {item.nextLesson ? (
                  <Button asChild>
                    <Link
                      href={`/dashboard/learn/${item.course.id}/lessons/${item.nextLesson.id}`}
                    >
                      <PlayCircle className="h-4 w-4" />
                      Resume
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant="outline">
                  <Link href={`/dashboard/learn/${item.course.id}`}>
                    Course home
                  </Link>
                </Button>
                {item.certificateNumber ? (
                  <Button asChild variant="outline">
                    <Link href={`/certificates/${item.certificateNumber}`}>
                      Certificate
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
