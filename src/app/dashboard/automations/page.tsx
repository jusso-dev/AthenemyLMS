import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { saveAutomationRecipeAction } from "./actions";
import { Bell, History, Workflow } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAppUser } from "@/lib/auth";
import { automationExecutionMode } from "@/lib/automations/dispatcher";
import { builtInAutomationRecipes } from "@/lib/automations/events";
import { databaseIsConfigured, fallbackNotice } from "@/lib/dashboard-data";
import { canManageOrganization } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { SetupMessage } from "@/lib/setup-message";

const runStatusVariant: Record<
  string,
  "default" | "secondary" | "success" | "outline"
> = {
  PENDING: "outline",
  RUNNING: "secondary",
  SUCCEEDED: "success",
  FAILED: "default",
  SKIPPED: "outline",
};

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
                automationRules: { orderBy: { updatedAt: "desc" } },
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

  const executionMode = automationExecutionMode();

  return (
    <div className="space-y-8">
      {!hasDatabase ? <SetupMessage {...fallbackNotice()} /> : null}
      <PageHeader
        title="Automations"
        description="Lifecycle recipes, background delivery, and notification history."
      />
      <div className="rounded-md border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Background delivery</p>
        <p className="mt-1 text-muted-foreground">
          Enabled recipes are queued durably and delivered by your background
          worker. Failed deliveries retry automatically up to five times.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <Workflow className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm text-muted-foreground">
              Execution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">{executionMode}</Badge>
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
              {primary ? (
                <ActionForm
                  action={saveAutomationRecipeAction}
                  className="mt-3"
                >
                  <input
                    type="hidden"
                    name="organizationId"
                    value={primary.id}
                  />
                  <input
                    type="hidden"
                    name="actionType"
                    value={recipe.actionType}
                  />
                  <input
                    type="hidden"
                    name="enabled"
                    value={String(
                      !primary.automationRules.find(
                        (rule) => rule.actionType === recipe.actionType,
                      )?.enabled,
                    )}
                  />
                  <PendingSubmitButton variant="outline" size="sm">
                    {primary.automationRules.find(
                      (rule) => rule.actionType === recipe.actionType,
                    )?.enabled
                      ? "Pause recipe"
                      : "Enable recipe"}
                  </PendingSubmitButton>
                </ActionForm>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
      {primary ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {primary.automationRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No automation runs yet. They appear here once an enabled rule
                matches a learning event.
              </p>
            ) : null}
            {primary.automationRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{run.id}</p>
                  <p className="text-sm text-muted-foreground">
                    {run.createdAt.toISOString()} · {run.attempts} attempts
                    {run.error ? ` · ${run.error}` : ""}
                  </p>
                </div>
                <Badge variant={runStatusVariant[run.status] ?? "outline"}>
                  {run.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
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
