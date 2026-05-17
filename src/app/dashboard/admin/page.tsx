import { Users, BookOpen, ReceiptText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAppUser } from "@/lib/auth";
import { analyticsFallbackNotice, getAdminAnalytics } from "@/lib/analytics";
import { SetupMessage } from "@/lib/setup-message";
import { prisma } from "@/lib/prisma";

const statIcons = {
  Users,
  Courses: BookOpen,
  Enrollments: ShieldCheck,
  Payments: ReceiptText,
};

export default async function AdminPage() {
  const user = await getCurrentAppUser();
  const analytics = await getAdminAnalytics(user);
  const auditLogs =
    analytics.mode === "database"
      ? await prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            actor: { select: { name: true, email: true } },
            organization: { select: { name: true } },
          },
        })
      : [];

  return (
    <div className="space-y-8">
      {analytics.mode === "fallback" ? (
        <SetupMessage {...analyticsFallbackNotice()} />
      ) : null}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-2 text-muted-foreground">
          Platform stats, users, courses, enrollments, role assignment, and
          recent payment events.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {analytics.stats.map((stat) => {
          const Icon =
            statIcons[stat.label as keyof typeof statIcons] ?? ShieldCheck;
          return (
            <Card key={stat.label}>
              <CardHeader className="pb-2">
                <Icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analytics.mode === "permission" ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Admin access is required to view platform analytics.
            </p>
          ) : null}
          {analytics.mode !== "permission" && analytics.users.length === 0 ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              No users have been recorded yet.
            </p>
          ) : null}
          {analytics.users.map((user) => (
            <div
              key={user.email}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <p className="font-medium">{user.name ?? "Unnamed user"}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <Badge variant={user.role === "ADMIN" ? "gold" : "outline"}>
                {user.role}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analytics.mode === "permission" ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Admin access is required to view audit events.
            </p>
          ) : null}
          {analytics.mode !== "permission" && auditLogs.length === 0 ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              No audit events have been recorded yet.
            </p>
          ) : null}
          {auditLogs.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <p className="font-medium">{event.action}</p>
                <p className="text-sm text-muted-foreground">
                  {event.entityType}
                  {event.entityId ? `:${event.entityId}` : ""} ·{" "}
                  {event.organization?.name ?? "Platform"}
                </p>
              </div>
              <Badge variant={event.severity === "INFO" ? "outline" : "gold"}>
                {event.severity}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
