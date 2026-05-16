import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isClerkConfigured } from "@/lib/auth";

const features = [
  {
    icon: BookOpen,
    title: "Structured course delivery",
    text: "Courses, sections, lessons, resources, progress, and previews are built into the core model.",
  },
  {
    icon: ShieldCheck,
    title: "Role-aware workspace",
    text: "Student, instructor, and admin paths share one product without blurring permissions.",
  },
  {
    icon: Database,
    title: "Self-hostable foundation",
    text: "Next.js, Supabase Postgres, Prisma, Clerk, R2, and Stripe with explicit setup boundaries.",
  },
  {
    icon: Users,
    title: "Creator-friendly operations",
    text: "Track enrollment, completion, student progress, and revenue from a calm dashboard.",
  },
];

export default async function Home() {
  if (isClerkConfigured()) {
    const { userId } = await auth();
    if (userId) redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="subtle-grid border-b">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:py-24">
            <div className="flex flex-col justify-center">
              <Badge variant="gold" className="w-fit">
                Open-source LMS starter
              </Badge>
              <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
                Athenemy
              </h1>
              <p className="mt-4 max-w-2xl text-xl text-muted-foreground">
                Wisdom, structured into courses.
              </p>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
                A clean, self-hostable LMS for selling, delivering, and tracking
                online courses. Simpler than Moodle, more ownership-focused than
                hosted course platforms, and modern enough to become a SaaS
                foundation.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    Open dashboard
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/courses">Browse courses</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="rounded-md border bg-background p-4">
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="text-sm font-medium">Instructor command</p>
                    <p className="text-xs text-muted-foreground">
                      Course health and learner momentum
                    </p>
                  </div>
                  <Sparkles className="h-5 w-5 text-[color:var(--gold)]" />
                </div>
                <div className="grid gap-3 py-4 sm:grid-cols-2">
                  <div className="rounded-md border bg-card p-4">
                    <p className="text-2xl font-semibold">0</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Active enrollments
                    </p>
                  </div>
                  <div className="rounded-md border bg-card p-4">
                    <p className="text-2xl font-semibold">$0</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Revenue this month
                    </p>
                  </div>
                </div>
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Published course activity appears here after your catalogue is
                  connected.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">
              Built for course ownership
            </h2>
            <p className="mt-3 text-muted-foreground">
              The MVP keeps the hard product boundaries visible: content,
              learning, commerce, storage, roles, and operations.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="h-6 w-6 text-primary" />
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {feature.text}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y bg-card">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-3 lg:px-8">
            {[
              "Launch a catalogue",
              "Sell paid courses",
              "Track completion",
            ].map((item) => (
              <div key={item} className="flex gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 text-secondary" />
                <div>
                  <h3 className="font-semibold">{item}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Use the included data model, dashboard routes, and API
                    endpoints as a production-quality starting point.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
