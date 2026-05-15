import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
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
