"use client";

import Link from "next/link";
import {
  BookOpen,
  CreditCard,
  GraduationCap,
  Home,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Overview", icon: Home, exact: true },
  { href: "/dashboard/my-courses", label: "My courses", icon: GraduationCap },
  { href: "/dashboard/courses", label: "Manage", icon: BookOpen },
  { href: "/dashboard/admin", label: "Admin", icon: ShieldCheck },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav({ className }: { className?: string }) {
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
              active && "bg-muted text-foreground shadow-sm",
            )}
          >
            <item.icon
              className={cn("h-4 w-4", active && "text-primary")}
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
              active && "bg-muted text-foreground",
            )}
          >
            <item.icon
              className={cn("h-4 w-4", active && "text-primary")}
              aria-hidden="true"
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
