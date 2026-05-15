import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  CreditCard,
  GraduationCap,
  Home,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/brand/logo";
import { isClerkConfigured } from "@/lib/auth";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/my-courses", label: "My courses", icon: GraduationCap },
  { href: "/dashboard/courses", label: "Manage courses", icon: BookOpen },
  { href: "/dashboard/admin", label: "Admin", icon: ShieldCheck },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card px-4 py-5 lg:block">
        <Logo />
        <nav aria-label="Dashboard" className="mt-8 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 rounded-lg bg-muted p-4 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <BarChart3 className="h-4 w-4 text-[color:var(--gold)]" />
            MVP workspace
          </div>
          <p className="mt-2 text-muted-foreground">
            Local mock data appears until Supabase is configured.
          </p>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <Logo compact className="lg:hidden" />
          <div className="hidden text-sm text-muted-foreground lg:block">
            Athenemy workspace
          </div>
          <div className="flex items-center gap-3">
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
        <main className={cn("mx-auto max-w-7xl px-4 py-8 sm:px-6", className)}>
          {children}
        </main>
      </div>
    </div>
  );
}
