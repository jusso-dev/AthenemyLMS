import { Search, Send, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
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

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string | string[] }>;
}) {
  const params = await searchParams;
  const memberQuery = Array.isArray(params.member)
    ? params.member[0]
    : params.member;
  const normalizedMemberQuery = memberQuery?.trim().toLowerCase() ?? "";
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
      <PageHeader
        title="Settings"
        description="Profile, instructor identity, and organisation administration."
      />
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
          <CardTitle>Organisation administration</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <ActionForm
            action={createOrganizationFormAction}
            className="grid gap-4 rounded-md border bg-muted/20 p-4"
          >
            <div>
              <p className="font-medium">Create organisation</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The creator becomes the first owner and can invite the rest of
                the team.
              </p>
            </div>
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
            const members = membership.organization.memberships.filter(
              (orgMember) => {
                if (!normalizedMemberQuery) return true;
                return [
                  orgMember.user.name,
                  orgMember.user.email,
                  orgMember.user.role,
                  orgMember.role,
                ]
                  .filter(Boolean)
                  .some((value) =>
                    String(value).toLowerCase().includes(normalizedMemberQuery),
                  );
              },
            );
            const pendingInvitations = membership.organization.invitations.filter(
              (invitation) => invitation.status === "PENDING",
            );
            const ownerCount = membership.organization.memberships.filter(
              (orgMember) => orgMember.role === "OWNER",
            ).length;

            return (
              <div
                key={membership.id}
                className="space-y-5 rounded-md border bg-card p-4"
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

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      label: "Members",
                      value: membership.organization.memberships.length,
                    },
                    { label: "Owners", value: ownerCount },
                    { label: "Pending invites", value: pendingInvitations.length },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-md border bg-background p-4"
                    >
                      <p className="text-sm text-muted-foreground">
                        {stat.label}
                      </p>
                      <p className="mt-1 text-2xl font-semibold">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                <ActionForm
                  action={inviteOrganizationMemberFormAction}
                  className="grid gap-3 rounded-md border bg-muted/20 p-4 sm:grid-cols-[1fr_160px_auto]"
                >
                  <div className="sm:col-span-3">
                    <p className="font-medium">Invite member</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Send a Clerk invitation and prepare the local organisation
                      role in one action.
                    </p>
                  </div>
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
                    <Send className="h-4 w-4" />
                    Invite member
                  </PendingSubmitButton>
                </ActionForm>

                <div className="space-y-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-sm font-medium">Members</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Update identity, app role, organisation role, access
                        resets, and removals.
                      </p>
                    </div>
                    <form className="relative w-full lg:max-w-xs">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        aria-label="Search organisation members"
                        type="search"
                        name="member"
                        defaultValue={memberQuery}
                        placeholder="Search members"
                        className="pl-9"
                      />
                    </form>
                  </div>
                  <div className="hidden rounded-md border bg-muted/40 px-3 py-2 text-xs font-medium uppercase text-muted-foreground lg:grid lg:grid-cols-[1fr_140px_150px_240px]">
                    <span>Member</span>
                    <span>App role</span>
                    <span>Org role</span>
                    <span>Actions</span>
                  </div>
                  {members.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No matching members"
                      description="Try searching by name, email, app role, or organisation role."
                    />
                  ) : null}
                  {members.map((orgMember) => (
                    <div
                      key={orgMember.id}
                      className="rounded-md border bg-background p-3"
                    >
                      <ActionForm
                        action={updateOrganizationMemberFormAction}
                        className="grid gap-3 lg:grid-cols-[1fr_140px_150px_240px]"
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
                        <div>
                          <Input
                            aria-label={`${orgMember.user.email} display name`}
                            name="name"
                            defaultValue={orgMember.user.name ?? ""}
                            placeholder="Display name"
                            disabled={!canManage}
                          />
                          <p className="mt-2 text-xs text-muted-foreground">
                            {orgMember.user.email}
                          </p>
                        </div>
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
                      <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
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
                        <ActionForm action={deleteOrganizationMemberFormAction}>
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
                            disabled={!canManage || orgMember.userId === user?.id}
                            pendingLabel="Deleting..."
                          >
                            Delete user
                          </PendingSubmitButton>
                        </ActionForm>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Invitations</p>
                  <div className="grid gap-2">
                    {membership.organization.invitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="grid gap-2 rounded-md border bg-background p-3 text-sm sm:grid-cols-[1fr_140px_120px]"
                      >
                        <span className="font-medium">{invitation.email}</span>
                        <span className="text-muted-foreground">
                          {invitation.role}
                        </span>
                        <Badge
                          variant={
                            invitation.status === "PENDING"
                              ? "gold"
                              : invitation.status === "ACCEPTED"
                                ? "success"
                                : "outline"
                          }
                          className="w-fit"
                        >
                          {invitation.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  {membership.organization.invitations.length === 0 ? (
                    <EmptyState
                      icon={Send}
                      title="No invitations yet"
                      description="Pending and accepted invitations will appear here after you invite teammates."
                    />
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
