import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("h-9 w-9", className)}
    >
      <rect width="64" height="64" rx="14" fill="var(--primary)" />
      <path
        d="M32 8 50 16v15c0 12-7.4 20.8-18 25-10.6-4.2-18-13-18-25V16L32 8Z"
        fill="var(--background)"
      />
      <path
        d="M22 22h20v4H22zm4 8h12v4H26zm-3 8h18v4H23z"
        fill="var(--primary)"
      />
      <circle cx="24" cy="19" r="3" fill="var(--gold)" />
      <circle cx="40" cy="19" r="3" fill="var(--gold)" />
    </svg>
  );
}

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="Athenemy home"
      className={cn("inline-flex items-center gap-3 font-semibold", className)}
    >
      <LogoMark />
      {!compact && (
        <span className="text-lg tracking-tight text-foreground">Athenemy</span>
      )}
    </Link>
  );
}
