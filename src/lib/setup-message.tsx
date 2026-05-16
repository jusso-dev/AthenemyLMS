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
      className="border-amber-300/70 bg-card text-card-foreground shadow-none dark:border-amber-400/30"
    >
      <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <CardTitle className="text-base leading-6">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pl-16 text-sm leading-6 text-muted-foreground">
        <ul className="list-disc space-y-1 pl-4 marker:text-amber-600 dark:marker:text-amber-300">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
