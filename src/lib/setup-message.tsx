import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SetupMessage({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <Card
      role="status"
      className="border-[color:color-mix(in_oklab,var(--gold)_45%,var(--border))] bg-card text-card-foreground shadow-none"
    >
      <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <CardTitle className="text-base leading-6">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pl-16 text-sm leading-6 text-muted-foreground">
        <ul className="list-disc space-y-1 pl-4 marker:text-[color:var(--gold)]">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
