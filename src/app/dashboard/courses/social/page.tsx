import { CalendarDays, MessageSquare, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAppUser } from "@/lib/auth";
import { databaseIsConfigured, fallbackNotice } from "@/lib/dashboard-data";
import { SetupMessage } from "@/lib/setup-message";
import { prisma } from "@/lib/prisma";

export default async function SocialLearningPage() {
  const hasDatabase = databaseIsConfigured();
  const user = await getCurrentAppUser();
  const courseWhere =
    user?.role === "ADMIN"
      ? {}
      : user?.role === "INSTRUCTOR"
        ? { instructorId: user.id }
        : { enrollments: { some: { userId: user?.id } } };
  const [cohorts, threads, sessions] =
    hasDatabase && user
      ? await Promise.all([
          prisma.cohort.findMany({
            where: { course: courseWhere },
            include: { course: { select: { title: true } }, memberships: true },
            orderBy: { updatedAt: "desc" },
            take: 10,
          }),
          prisma.discussionThread.findMany({
            where: { course: courseWhere },
            include: { course: { select: { title: true } }, posts: true },
            orderBy: { updatedAt: "desc" },
            take: 10,
          }),
          prisma.liveSession.findMany({
            where: { course: courseWhere },
            include: { course: { select: { title: true } } },
            orderBy: { startsAt: "asc" },
            take: 10,
          }),
        ])
      : [[], [], []];

  return (
    <div className="space-y-8">
      {!hasDatabase ? <SetupMessage {...fallbackNotice()} /> : null}
      <PageHeader
        title="Social learning"
        description="Cohorts, course discussions, announcements, and live learning sessions."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm text-muted-foreground">
              Cohorts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{cohorts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm text-muted-foreground">
              Discussions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{threads.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm text-muted-foreground">
              Live sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{sessions.length}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Cohorts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cohorts.map((cohort) => (
            <div key={cohort.id} className="rounded-md border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{cohort.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {cohort.course.title} · {cohort.memberships.length} learners
                  </p>
                </div>
                <Badge
                  variant={cohort.status === "ACTIVE" ? "success" : "outline"}
                >
                  {cohort.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Discussions and live sessions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {threads.map((thread) => (
            <div key={thread.id} className="rounded-md border p-4">
              <p className="font-medium">{thread.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {thread.course.title} · {thread.posts.length} posts
              </p>
            </div>
          ))}
          {sessions.map((session) => (
            <div key={session.id} className="rounded-md border p-4">
              <p className="font-medium">{session.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {session.course.title} · {session.startsAt.toLocaleString()}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
