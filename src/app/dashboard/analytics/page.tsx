import Link from "next/link";
import { BarChart3, Download, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { getCurrentAppUser } from "@/lib/auth";
import {
  analyticsFallbackNotice,
  getInstructorAnalytics,
} from "@/lib/analytics";
import { formatPrice } from "@/lib/utils";
import { SetupMessage } from "@/lib/setup-message";

export default async function AnalyticsPage() {
  const user = await getCurrentAppUser();
  const analytics = await getInstructorAnalytics(user);

  return (
    <div className="space-y-6">
      {analytics.mode === "fallback" ? (
        <SetupMessage {...analyticsFallbackNotice()} />
      ) : null}
      <PageHeader
        title="Analytics"
        description="Organization learning health, course performance, completion, revenue, and reporting exports."
      />
      {analytics.mode === "permission" ? (
        <Card>
          <CardContent className="pt-6">
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Instructor or admin access is required to view analytics.
            </p>
          </CardContent>
        </Card>
      ) : null}
      {analytics.mode !== "permission" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {analytics.stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Course performance</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Completion, engagement, and revenue by course.
                </p>
              </div>
              <Badge variant="outline">
                {analytics.courses.length} courses
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.courses.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No analytics yet"
                  description="Published courses, enrollments, progress, and payments will populate this command center."
                />
              ) : null}
              {analytics.courses.map((course) => (
                <div
                  key={course.id}
                  className="grid gap-4 rounded-md border p-4 lg:grid-cols-[1fr_180px_140px_120px_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{course.title}</p>
                      <Badge variant="outline">{course.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {course.activeEnrollments} active ·{" "}
                      {course.completedEnrollments} complete
                    </p>
                  </div>
                  <div>
                    <Progress value={course.completionRate} />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {course.completionRate}% completion
                    </p>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">
                      {course.lessonCompletions} lesson completions
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Engagement signal
                    </p>
                  </div>
                  <div className="text-sm font-medium">
                    {formatPrice(course.revenueCents)}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/courses/${course.id}/insights`}>
                        <TrendingUp className="h-4 w-4" />
                        Insights
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/api/courses/${course.id}/reports/completions`}
                      >
                        <Download className="h-4 w-4" />
                        CSV
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
