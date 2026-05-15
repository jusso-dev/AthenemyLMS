import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold tracking-tight">About Athenemy</h1>
        <div className="mt-6 space-y-5 text-muted-foreground">
          <p>
            Athenemy is a clean LMS foundation for creators, teams, and small
            organisations that want ownership of their learning platform.
          </p>
          <p>
            The name blends Athena, the Greek goddess of wisdom, with academy.
            The product borrows that sense of calm structure without turning the
            interface into a mythology theme.
          </p>
          <p>
            This MVP is designed as open-source infrastructure: readable,
            documented, and explicit about the operational services it needs.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
