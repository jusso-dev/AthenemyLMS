import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateProfileAction } from "@/app/dashboard/courses/actions";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackNotice, databaseIsConfigured } from "@/lib/dashboard-data";
import { SetupMessage } from "@/lib/setup-message";

export default async function SettingsPage() {
  const user = await getCurrentAppUser();
  const hasDatabase = databaseIsConfigured();

  return (
    <div className="max-w-3xl space-y-6">
      {!hasDatabase ? <SetupMessage {...fallbackNotice()} /> : null}
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
          {!user && hasDatabase ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Sign in to update profile settings.
            </p>
          ) : null}
          <form action={updateProfileAction} className="grid gap-4">
            <Input
              name="name"
              placeholder="Display name"
              defaultValue={user?.name ?? ""}
              disabled={!hasDatabase || !user}
            />
            <Input
              name="websiteUrl"
              placeholder="Website URL"
              defaultValue={user?.websiteUrl ?? ""}
              disabled={!hasDatabase || !user}
            />
            <Textarea
              name="bio"
              placeholder="Instructor bio"
              defaultValue={user?.bio ?? ""}
              disabled={!hasDatabase || !user}
            />
            <Button className="w-fit" disabled={!hasDatabase || !user}>
              Save settings
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Organisation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Input placeholder="Organisation name" />
          <Input placeholder="Support email" />
          <Button variant="outline" className="w-fit">
            Save organisation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
