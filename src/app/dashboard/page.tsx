import Link from "next/link";
import { ArrowRight, BookOpen, CircleDollarSign, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dashboardStats, mockCourses } from "@/lib/mock-data";
import { getCurrentAppUser, isClerkConfigured } from "@/lib/auth";
import { SetupMessage } from "@/lib/setup-message";

export default async function DashboardPage() {
  const user = await getCurrentAppUser();

  return (
    <div className="space-y-8">
      {!isClerkConfigured() ? (
        <SetupMessage
          title="Local setup mode"
          items={[
            "Clerk is not configured, so protected dashboard pages show mock data.",
            "Add Clerk and Supabase values to .env.local to enable real authentication and persistence.",
          ]}
        />
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {user ? `Signed in as ${user.email}` : "Development preview"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
        </div>
        <Button asChild>
          <Link href="/dashboard/courses/new">
            Create course
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardStats.map((stat) => (
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
            {mockCourses.map((course) => (
              <div key={course.slug} className="rounded-md border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{course.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {course.instructor.name} · {course.level}
                    </p>
                  </div>
                  <Badge variant="success">Published</Badge>
                </div>
                <div className="mt-4 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-secondary"
                    style={{ width: `${course.priceCents === 0 ? 81 : 64}%` }}
                  />
                </div>
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
