import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-dashed bg-muted/25 p-6 text-sm",
        className,
      )}
    >
      <div className="flex gap-4">
        {Icon ? (
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-background text-primary ring-1 ring-border">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0 space-y-2">
          <p className="font-medium text-foreground">{title}</p>
          {description ? (
            <p className="max-w-2xl leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
          {action ? <div className="pt-1">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
