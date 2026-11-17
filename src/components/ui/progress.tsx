import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  label = "Progress",
}: {
  value: number;
  className?: string;
  label?: string;
}) {
  const boundedValue = Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 0;

  return (
    <div
      className={cn("h-2 overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={boundedValue}
    >
      <div
        className="h-full rounded-full bg-secondary transition-[width]"
        style={{ width: `${boundedValue}%` }}
      />
    </div>
  );
}
