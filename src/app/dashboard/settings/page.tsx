import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getCurrentAppUser } from "@/lib/auth";
import { missingEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { SetupMessage } from "@/lib/setup-message";
import {
  createOrganizationAction,
  inviteOrganizationMemberAction,
} from "@/app/dashboard/settings/organization-actions";

export default async function SettingsPage() {
  const databaseMissing = missingEnv(["DATABASE_URL"]).length > 0;
  const user = await getCurrentAppUser();
  const memberships =
    !databaseMissing && user
      ? await prisma.organizationMembership.findMany({
          where: { userId: user.id },
          include: {
            organization: {
              include: {
                invitations: { orderBy: { createdAt: "desc" }, take: 5 },
              },
            },
          },
        })
      : [];

  return (
    <div className="max-w-3xl space-y-6">
      {databaseMissing ? (
        <SetupMessage
          title="Supabase setup required"
          items={["Organisation tenancy requires DATABASE_URL and DIRECT_URL."]}
        />
      ) : null}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Profile, instructor identity, and organisation placeholders.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Input placeholder="Display name" />
          <Input placeholder="Website URL" />
          <Textarea placeholder="Instructor bio" />
          <Button className="w-fit">Save settings</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Organisation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <form action={createOrganizationAction} className="grid gap-4 rounded-md border p-4">
            <Input name="name" placeholder="Organisation name" disabled={databaseMissing || !user} />
            <Input name="supportEmail" type="email" placeholder="Support email" disabled={databaseMissing || !user} />
            <Button variant="outline" className="w-fit" disabled={databaseMissing || !user}>
              Create organisation
            </Button>
          </form>
          {memberships.map((membership) => (
            <div key={membership.id} className="space-y-4 rounded-md border p-4">
              <div>
                <p className="font-medium">{membership.organization.name}</p>
                <p className="text-sm text-muted-foreground">{membership.role}</p>
              </div>
              <form action={inviteOrganizationMemberAction} className="grid gap-3">
                <input type="hidden" name="organizationId" value={membership.organizationId} />
                <Input name="email" type="email" placeholder="teammate@example.com" />
                <select
                  name="role"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="MEMBER"
                >
                  <option value="MEMBER">Member</option>
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <Button className="w-fit">Invite member</Button>
              </form>
              <div className="space-y-2">
                {membership.organization.invitations.map((invitation) => (
                  <p key={invitation.id} className="text-sm text-muted-foreground">
                    {invitation.email} · {invitation.role} · {invitation.status}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
