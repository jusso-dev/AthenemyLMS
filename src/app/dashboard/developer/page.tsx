import { Code2, KeyRound, Webhook } from "lucide-react";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import {
  createApiKeyFormAction,
  createWebhookEndpointFormAction,
} from "@/app/dashboard/developer/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentAppUser } from "@/lib/auth";
import { apiScopes } from "@/lib/developer/api-keys";
import { webhookEventTypes } from "@/lib/developer/webhooks";
import { databaseIsConfigured, fallbackNotice } from "@/lib/dashboard-data";
import { canManageOrganization } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { SetupMessage } from "@/lib/setup-message";

export default async function DeveloperPage() {
  const hasDatabase = databaseIsConfigured();
  const user = await getCurrentAppUser();
  const memberships =
    hasDatabase && user
      ? await prisma.organizationMembership.findMany({
          where: { userId: user.id },
          include: {
            organization: {
              include: {
                apiKeys: { orderBy: { createdAt: "desc" }, take: 10 },
                webhookEndpoints: {
                  orderBy: { createdAt: "desc" },
                  take: 10,
                  include: {
                    deliveries: { orderBy: { createdAt: "desc" }, take: 3 },
                  },
                },
              },
            },
          },
        })
      : [];
  const manageable = memberships.filter((membership) =>
    canManageOrganization(user, membership),
  );
  const primary = manageable[0]?.organization;

  return (
    <div className="space-y-8">
      {!hasDatabase ? <SetupMessage {...fallbackNotice()} /> : null}
      <PageHeader
        title="Developer platform"
        description="API keys, scoped REST endpoints, signed webhooks, and integration documentation."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "API namespace", value: "/api/v1", icon: Code2 },
          {
            label: "Available scopes",
            value: apiScopes.length,
            icon: KeyRound,
          },
          {
            label: "Webhook events",
            value: webhookEventTypes.length,
            icon: Webhook,
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <item.icon className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm text-muted-foreground">
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {!primary ? (
        <p className="rounded-md border p-4 text-sm text-muted-foreground">
          Organisation admin access is required to manage developer tools.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Create API key</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={createApiKeyFormAction}
                className="grid gap-4"
              >
                <input type="hidden" name="organizationId" value={primary.id} />
                <Input name="name" placeholder="Integration name" required />
                <div className="grid gap-2 sm:grid-cols-2">
                  {apiScopes.map((scope) => (
                    <label
                      key={scope}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="scopes"
                        value={scope}
                        defaultChecked={scope === "org:read"}
                      />
                      {scope}
                    </label>
                  ))}
                </div>
                <PendingSubmitButton className="w-fit">
                  <KeyRound className="h-4 w-4" />
                  Create key
                </PendingSubmitButton>
              </ActionForm>
              <div className="mt-5 space-y-2">
                {primary.apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {key.keyPrefix}... · {key.scopes.join(", ")}
                      </p>
                    </div>
                    <Badge variant={key.revokedAt ? "outline" : "success"}>
                      {key.revokedAt ? "Revoked" : "Active"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Webhook endpoints</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={createWebhookEndpointFormAction}
                className="grid gap-4"
              >
                <input type="hidden" name="organizationId" value={primary.id} />
                <Input
                  name="url"
                  type="url"
                  placeholder="https://example.com/webhook"
                  required
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {webhookEventTypes.slice(0, 8).map((eventType) => (
                    <label
                      key={eventType}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="eventTypes"
                        value={eventType}
                      />
                      {eventType}
                    </label>
                  ))}
                </div>
                <PendingSubmitButton className="w-fit">
                  <Webhook className="h-4 w-4" />
                  Add endpoint
                </PendingSubmitButton>
              </ActionForm>
              <div className="mt-5 space-y-2">
                {primary.webhookEndpoints.map((endpoint) => (
                  <div key={endpoint.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-medium">{endpoint.url}</p>
                      <Badge variant={endpoint.active ? "success" : "outline"}>
                        {endpoint.active ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {endpoint.eventTypes.length
                        ? endpoint.eventTypes.join(", ")
                        : "All events"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Recent deliveries: {endpoint.deliveries.length}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Documentation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Authenticate with <code>Authorization: Bearer ath_...</code>. Errors
            use <code>{"{ error: { code, message, requestId } }"}</code> and
            responses include <code>x-request-id</code>.
          </p>
          <p>
            Initial endpoints include <code>GET /api/v1/me</code>, courses,
            enrollments, progress, certificates, portal catalogue data, and
            webhook endpoint management.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
