import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoTone = "default" | "on-navy";

export function LogoMark({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "sm";
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/athenemy-mark.svg"
      alt=""
      aria-hidden="true"
      className={cn(
        "rounded-md object-contain",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        className,
      )}
    />
  );
}

export function Logo({
  compact = false,
  className,
  tone = "default",
}: {
  compact?: boolean;
  className?: string;
  tone?: LogoTone;
}) {
  return (
    <Link
      href="/"
      aria-label="Athenemy home"
      className={cn("inline-flex items-center gap-3 font-semibold", className)}
    >
      {compact ? (
        <LogoMark size="sm" />
      ) : (
        <>
          <LogoMark />
          <span
            className={cn(
              "text-lg font-semibold tracking-tight",
              tone === "on-navy"
                ? "text-[#D4AF37]"
                : "text-[#071A3D] dark:text-[#D4AF37]",
            )}
          >
            Athenemy
          </span>
        </>
      )}
    </Link>
  );
}
