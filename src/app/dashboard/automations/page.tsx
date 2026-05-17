import { Bell, History, Workflow } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAppUser } from "@/lib/auth";
import {
  builtInAutomationRecipes,
  triggerDevConfigured,
} from "@/lib/automations/events";
import { databaseIsConfigured, fallbackNotice } from "@/lib/dashboard-data";
import { canManageOrganization } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { SetupMessage } from "@/lib/setup-message";

export default async function AutomationsPage() {
  const hasDatabase = databaseIsConfigured();
  const user = await getCurrentAppUser();
  const memberships =
    hasDatabase && user
      ? await prisma.organizationMembership.findMany({
          where: { userId: user.id },
          include: {
            organization: {
              include: {
                automationRules: { orderBy: { updatedAt: "desc" }, take: 10 },
                automationRuns: { orderBy: { createdAt: "desc" }, take: 10 },
                notificationDeliveries: {
                  orderBy: { createdAt: "desc" },
                  take: 10,
                },
              },
            },
          },
        })
      : [];
  const primary = memberships.find((membership) =>
    canManageOrganization(user, membership),
  )?.organization;

  return (
    <div className="space-y-8">
      {!hasDatabase ? <SetupMessage {...fallbackNotice()} /> : null}
      <PageHeader
        title="Automations"
        description="Lifecycle events, built-in recipes, notification delivery, and Trigger.dev readiness."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <Workflow className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm text-muted-foreground">
              Trigger.dev
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={triggerDevConfigured() ? "success" : "outline"}>
              {triggerDevConfigured() ? "Configured" : "Not configured"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm text-muted-foreground">
              Built-in recipes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {builtInAutomationRecipes.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <History className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm text-muted-foreground">
              Recent runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {primary?.automationRuns.length ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recipes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {builtInAutomationRecipes.map((recipe) => (
            <div key={recipe.name} className="rounded-md border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{recipe.name}</p>
                <Badge variant="outline">{recipe.eventType}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {recipe.actionType}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent delivery state</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!primary ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Organisation admin access is required to view automation history.
            </p>
          ) : null}
          {primary?.notificationDeliveries.map((delivery) => (
            <div
              key={delivery.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <p className="font-medium">{delivery.template}</p>
                <p className="text-sm text-muted-foreground">
                  {delivery.channel} · {delivery.recipient}
                </p>
              </div>
              <Badge
                variant={delivery.status === "SENT" ? "success" : "outline"}
              >
                {delivery.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
