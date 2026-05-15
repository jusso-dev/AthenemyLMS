import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptInvitationAction } from "@/app/dashboard/settings/organization-actions";
import { missingEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { SetupMessage } from "@/lib/setup-message";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const databaseMissing = missingEnv(["DATABASE_URL"]).length > 0;
  const invitation = databaseMissing
    ? null
    : await prisma.organizationInvitation.findUnique({
        where: { token },
        include: { organization: true },
      });

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      {databaseMissing ? (
        <SetupMessage
          title="Supabase setup required"
          items={["Invitation acceptance requires DATABASE_URL."]}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Organisation invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {invitation
              ? `Join ${invitation.organization.name} as ${invitation.role}.`
              : "This invitation is unavailable or has expired."}
          </p>
          <form action={acceptInvitationAction.bind(null, token)}>
            <Button disabled={!invitation || invitation.status !== "PENDING"}>
              Accept invitation
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
