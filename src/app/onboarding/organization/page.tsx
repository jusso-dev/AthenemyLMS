import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createOnboardingOrganizationAction } from "@/app/dashboard/settings/organization-actions";
import { getCurrentAppUser, isClerkConfigured } from "@/lib/auth";
import { missingEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { SetupMessage } from "@/lib/setup-message";

export default async function OrganizationOnboardingPage() {
  const hasDatabase = missingEnv(["DATABASE_URL"]).length === 0;
  const user = hasDatabase ? await getCurrentAppUser() : null;

  if (hasDatabase && user) {
    const membershipCount = await prisma.organizationMembership.count({
      where: { userId: user.id },
    });
    if (membershipCount > 0) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        {!isClerkConfigured() ? (
          <SetupMessage
            title="Clerk setup required"
            items={[
              "Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to .env.local.",
            ]}
          />
        ) : null}
        {!hasDatabase ? (
          <SetupMessage
            title="Supabase setup required"
            items={["Organisation onboarding requires DATABASE_URL."]}
          />
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Create your organisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-6 text-muted-foreground">
              This becomes the workspace for your courses, members, invitations,
              and administration.
            </p>
            <form
              action={createOnboardingOrganizationAction}
              className="grid gap-4"
            >
              <Input
                aria-label="Organisation name"
                name="name"
                placeholder="Organisation name"
                disabled={!hasDatabase || !user}
                required
              />
              <Input
                aria-label="Support email"
                name="supportEmail"
                type="email"
                placeholder="Support email"
                defaultValue={user?.email ?? ""}
                disabled={!hasDatabase || !user}
              />
              <Button disabled={!hasDatabase || !user}>
                Create organisation
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
