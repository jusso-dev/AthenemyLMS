"use client";

import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  CreditCard,
  GraduationCap,
  Home,
  LayoutTemplate,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Overview", icon: Home, exact: true },
  { href: "/dashboard/my-courses", label: "My courses", icon: GraduationCap },
  { href: "/dashboard/courses", label: "Manage", icon: BookOpen },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/site", label: "Portal", icon: LayoutTemplate },
  { href: "/dashboard/admin", label: "Admin", icon: ShieldCheck },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav({
  className,
  tone = "default",
}: {
  className?: string;
  tone?: "default" | "navy";
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" className={cn("space-y-1", className)}>
      {nav.map((item) => {
        const active = isActive(pathname, item.href, item.exact);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              tone === "navy" &&
                "text-[#C8D2E3] hover:bg-white/10 hover:text-white",
              active && "bg-muted text-foreground shadow-sm",
              tone === "navy" &&
                active &&
                "bg-white/10 text-white shadow-none ring-1 ring-white/10",
            )}
          >
            <item.icon
              className={cn(
                "h-4 w-4",
                active && "text-primary",
                tone === "navy" && active && "text-[#D4AF37]",
              )}
              aria-hidden="true"
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardMobileNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard"
      className={cn(
        "flex gap-2 overflow-x-auto border-b bg-background/95 px-4 py-2 sm:px-6 lg:hidden",
        className,
      )}
    >
      {nav.map((item) => {
        const active = isActive(pathname, item.href, item.exact);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active &&
                "bg-[#071A3D] text-white dark:bg-muted dark:text-foreground",
            )}
          >
            <item.icon
              className={cn(
                "h-4 w-4",
                active && "text-[#D4AF37] dark:text-primary",
              )}
              aria-hidden="true"
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
