import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-muted text-muted-foreground",
        gold: "bg-[color:color-mix(in_oklab,var(--gold)_18%,var(--background))] text-accent-foreground ring-1 ring-[color:color-mix(in_oklab,var(--gold)_42%,transparent)]",
        success:
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
        outline: "border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
