import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { updateProfileFormAction } from "@/app/dashboard/courses/actions";
import {
  createOrganizationFormAction,
  deleteOrganizationMemberFormAction,
  inviteOrganizationMemberFormAction,
  requirePasswordResetFormAction,
  updateOrganizationMemberFormAction,
} from "@/app/dashboard/settings/organization-actions";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackNotice, databaseIsConfigured } from "@/lib/dashboard-data";
import { canManageOrganization } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { SetupMessage } from "@/lib/setup-message";

export default async function SettingsPage() {
  const user = await getCurrentAppUser();
  const hasDatabase = databaseIsConfigured();
  const memberships =
    hasDatabase && user
      ? await prisma.organizationMembership.findMany({
          where: { userId: user.id },
          include: {
            organization: {
              include: {
                memberships: {
                  orderBy: { createdAt: "asc" },
                  include: { user: true },
                },
                invitations: { orderBy: { createdAt: "desc" }, take: 10 },
              },
            },
          },
        })
      : [];

  return (
    <div className="max-w-6xl space-y-6">
      {!hasDatabase ? <SetupMessage {...fallbackNotice()} /> : null}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Profile, instructor identity, and organisation administration.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!user && hasDatabase ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Sign in to update profile settings.
            </p>
          ) : null}
          <ActionForm action={updateProfileFormAction} className="grid gap-4">
            <Input
              aria-label="Display name"
              name="name"
              placeholder="Display name"
              defaultValue={user?.name ?? ""}
              disabled={!hasDatabase || !user}
            />
            <Input
              aria-label="Website URL"
              name="websiteUrl"
              placeholder="Website URL"
              defaultValue={user?.websiteUrl ?? ""}
              disabled={!hasDatabase || !user}
            />
            <Textarea
              aria-label="Instructor bio"
              name="bio"
              placeholder="Instructor bio"
              defaultValue={user?.bio ?? ""}
              disabled={!hasDatabase || !user}
            />
            <PendingSubmitButton
              className="w-fit"
              disabled={!hasDatabase || !user}
            >
              Save settings
            </PendingSubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Organisation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <ActionForm
            action={createOrganizationFormAction}
            className="grid gap-4 rounded-md border p-4"
          >
            <Input
              aria-label="Organisation name"
              name="name"
              placeholder="Organisation name"
              disabled={!hasDatabase || !user}
            />
            <Input
              aria-label="Support email"
              name="supportEmail"
              type="email"
              placeholder="Support email"
              disabled={!hasDatabase || !user}
            />
            <PendingSubmitButton
              variant="outline"
              className="w-fit"
              disabled={!hasDatabase || !user}
            >
              Create organisation
            </PendingSubmitButton>
          </ActionForm>
          {memberships.map((membership) => {
            const canManage = canManageOrganization(user, membership);

            return (
              <div
                key={membership.id}
                className="space-y-5 rounded-md border p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {membership.organization.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {membership.organization.supportEmail ??
                        "No support email"}{" "}
                      · Your role is {membership.role}
                    </p>
                  </div>
                  <Badge variant={canManage ? "gold" : "outline"}>
                    {canManage ? "Admin access" : "Member access"}
                  </Badge>
                </div>

                <ActionForm
                  action={inviteOrganizationMemberFormAction}
                  className="grid gap-3 rounded-md bg-muted p-3 sm:grid-cols-[1fr_160px_auto]"
                >
                  <input
                    type="hidden"
                    name="organizationId"
                    value={membership.organizationId}
                  />
                  <Input
                    aria-label="Invitee email"
                    name="email"
                    type="email"
                    placeholder="teammate@example.com"
                    disabled={!canManage}
                  />
                  <select
                    aria-label="Invitation role"
                    name="role"
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue="MEMBER"
                    disabled={!canManage}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="INSTRUCTOR">Instructor</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <PendingSubmitButton
                    className="w-fit"
                    disabled={!canManage}
                    pendingLabel="Inviting..."
                  >
                    Invite member
                  </PendingSubmitButton>
                </ActionForm>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Members</p>
                  {membership.organization.memberships.map((orgMember) => (
                    <div
                      key={orgMember.id}
                      className="rounded-md border bg-background p-3"
                    >
                      <ActionForm
                        action={updateOrganizationMemberFormAction}
                        className="grid gap-3 lg:grid-cols-[1fr_140px_150px_auto]"
                      >
                        <input
                          type="hidden"
                          name="organizationId"
                          value={membership.organizationId}
                        />
                        <input
                          type="hidden"
                          name="membershipId"
                          value={orgMember.id}
                        />
                        <Input
                          aria-label={`${orgMember.user.email} display name`}
                          name="name"
                          defaultValue={orgMember.user.name ?? ""}
                          placeholder="Display name"
                          disabled={!canManage}
                        />
                        <select
                          aria-label={`${orgMember.user.email} app role`}
                          name="appRole"
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          defaultValue={orgMember.user.role}
                          disabled={!canManage}
                        >
                          <option value="STUDENT">Student</option>
                          <option value="INSTRUCTOR">Instructor</option>
                          <option value="ADMIN">Platform admin</option>
                        </select>
                        <select
                          aria-label={`${orgMember.user.email} organisation role`}
                          name="orgRole"
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          defaultValue={orgMember.role}
                          disabled={!canManage}
                        >
                          <option value="MEMBER">Member</option>
                          <option value="INSTRUCTOR">Instructor</option>
                          <option value="ADMIN">Admin</option>
                          <option value="OWNER">Owner</option>
                        </select>
                        <PendingSubmitButton
                          variant="outline"
                          className="w-fit"
                          disabled={!canManage}
                        >
                          Update
                        </PendingSubmitButton>
                      </ActionForm>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {orgMember.user.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {orgMember.role} · {orgMember.user.role}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <ActionForm action={requirePasswordResetFormAction}>
                            <input
                              type="hidden"
                              name="organizationId"
                              value={membership.organizationId}
                            />
                            <input
                              type="hidden"
                              name="membershipId"
                              value={orgMember.id}
                            />
                            <PendingSubmitButton
                              size="sm"
                              variant="outline"
                              disabled={!canManage}
                              pendingLabel="Requiring..."
                            >
                              Require password reset
                            </PendingSubmitButton>
                          </ActionForm>
                          <ActionForm
                            action={deleteOrganizationMemberFormAction}
                          >
                            <input
                              type="hidden"
                              name="organizationId"
                              value={membership.organizationId}
                            />
                            <input
                              type="hidden"
                              name="membershipId"
                              value={orgMember.id}
                            />
                            <PendingSubmitButton
                              size="sm"
                              variant="destructive"
                              disabled={
                                !canManage || orgMember.userId === user?.id
                              }
                              pendingLabel="Deleting..."
                            >
                              Delete user
                            </PendingSubmitButton>
                          </ActionForm>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Invitations</p>
                  {membership.organization.invitations.map((invitation) => (
                    <p
                      key={invitation.id}
                      className="text-sm text-muted-foreground"
                    >
                      {invitation.email} · {invitation.role} ·{" "}
                      {invitation.status}
                    </p>
                  ))}
                  {membership.organization.invitations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No invitations have been sent yet.
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
