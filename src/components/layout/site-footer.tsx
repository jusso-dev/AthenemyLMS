import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Wisdom, structured into courses. A modern self-hostable LMS for
            creators, teams, and small organisations.
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-semibold">Product</p>
          <Link
            className="block text-muted-foreground hover:text-foreground"
            href="/courses"
          >
            Catalogue
          </Link>
          <Link
            className="block text-muted-foreground hover:text-foreground"
            href="/pricing"
          >
            Pricing
          </Link>
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-semibold">Open source</p>
          <Link
            className="block text-muted-foreground hover:text-foreground"
            href="/about"
          >
            About
          </Link>
          <Link
            className="block text-muted-foreground hover:text-foreground"
            href="/dashboard"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </footer>
  );
}
