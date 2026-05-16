import Link from "next/link";
import { Users } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/brand/logo";
import {
  DashboardMobileNav,
  DashboardNav,
} from "@/components/layout/dashboard-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { isClerkConfigured } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function DashboardShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[#132746] bg-[#071A3D] px-4 py-5 lg:block">
        <Logo tone="on-navy" />
        <DashboardNav className="mt-8" tone="navy" />
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <Logo compact className="lg:hidden" />
          <div className="hidden text-sm font-medium text-muted-foreground lg:block">
            Athenemy workspace
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              Catalogue
            </Link>
            {isClerkConfigured() ? <UserButton /> : null}
          </div>
        </header>
        <DashboardMobileNav />
        <main className={cn("mx-auto max-w-7xl px-4 py-8 sm:px-6", className)}>
          {children}
        </main>
      </div>
    </div>
  );
}
