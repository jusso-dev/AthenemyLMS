import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CircleDollarSign,
  GraduationCap,
  LibraryBig,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { getCurrentAppUser, isClerkConfigured } from "@/lib/auth";
import { SetupMessage } from "@/lib/setup-message";
import {
  analyticsFallbackNotice,
  getInstructorAnalytics,
} from "@/lib/analytics";

export default async function DashboardPage() {
  const user = await getCurrentAppUser();
  const analytics = await getInstructorAnalytics(user);

  return (
    <div className="space-y-8">
      {!isClerkConfigured() || analytics.mode === "fallback" ? (
        <SetupMessage {...analyticsFallbackNotice()} />
      ) : null}

      <PageHeader
        eyebrow={
          <>
            {user ? `Signed in as ${user.email}` : "Development preview"}
          </>
        }
        title="Dashboard"
        description="A single operating view for courses, learner activity, revenue, and the next work that needs attention."
        actions={
          <Button asChild>
            <Link href="/dashboard/courses/new">
              Create course
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {analytics.stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Course performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.mode === "permission" ? (
              <p className="rounded-md border p-4 text-sm text-muted-foreground">
                Instructor or admin access is required to view course analytics.
              </p>
            ) : null}
            {analytics.mode !== "permission" && analytics.courses.length === 0 ? (
              <EmptyState
                icon={LibraryBig}
                title="No course activity yet"
                description="Publish a course and enroll learners to start seeing progress, completions, and revenue here."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard/courses/new">Create course</Link>
                  </Button>
                }
              />
            ) : null}
            {analytics.courses.map((course) => (
              <div key={course.id} className="rounded-md border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{course.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {course.instructor?.name ?? "Athenemy faculty"} · {course.level}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {course.activeEnrollments} active · {course.completionRate}% completion · {course.lessonCompletions} lesson completions
                    </p>
                  </div>
                  <Badge variant={course.status === "PUBLISHED" ? "success" : "outline"}>
                    {course.status}
                  </Badge>
                </div>
                <Progress value={course.progressScore} className="mt-4" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Next actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { href: "/dashboard/my-courses", icon: GraduationCap, label: "Resume learning" },
              { href: "/dashboard/courses", icon: BookOpen, label: "Manage catalogue" },
              { href: "/dashboard/admin", icon: Users, label: "Review platform" },
              { href: "/dashboard/billing", icon: CircleDollarSign, label: "Check billing" },
            ].map((item) => (
              <Button key={item.href} asChild variant="outline" className="w-full justify-start">
                <Link href={item.href}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
