import Link from "next/link";
import { BookOpen, CheckCircle2, GraduationCap } from "lucide-react";
import { CourseCard } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  blockConfig,
  publicBlockConfig,
  type PortalBlockConfig,
  type PortalTheme,
} from "@/lib/portal";
import { cn } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

type PortalBlock = {
  id: string;
  type: string;
  config?: Prisma.JsonValue;
  publishedConfig?: Prisma.JsonValue | null;
};

type PortalCourse = React.ComponentProps<typeof CourseCard>["course"] & {
  id?: string;
  description?: string | null;
};

export function PortalShell({
  organizationName,
  organizationSlug,
  theme,
  signedIn,
  children,
}: {
  organizationName: string;
  organizationSlug: string;
  theme: PortalTheme;
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const rootStyle = {
    "--primary": theme.primaryColor,
    "--primary-dark": theme.primaryColor,
    "--secondary": theme.accentColor,
    "--ring": theme.primaryColor,
  } as React.CSSProperties;

  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground",
        theme.fontFamily === "serif" && "font-serif",
        theme.fontFamily === "mono" && "font-mono",
      )}
      style={rootStyle}
    >
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <Link
            href={`/s/${organizationSlug}`}
            className="flex items-center gap-3"
          >
            {theme.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={theme.logoUrl}
                alt=""
                className="h-9 w-9 rounded-md object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                {organizationName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="font-semibold">{organizationName}</span>
          </Link>
          <nav
            aria-label={`${organizationName} portal`}
            className="flex flex-wrap items-center gap-2"
          >
            {theme.navLinks.map((link) => (
              <Link
                key={`${link.label}-${link.href}`}
                href={resolvePortalHref(link.href, organizationSlug)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Button asChild size="sm">
              <Link href={signedIn ? "/dashboard/my-courses" : "/sign-in"}>
                {signedIn ? "Continue learning" : "Sign in"}
              </Link>
            </Button>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>{organizationName}</p>
          <div className="flex flex-wrap gap-3">
            {theme.footerLinks.map((link) => (
              <Link
                key={`${link.label}-${link.href}`}
                href={resolvePortalHref(link.href, organizationSlug)}
                className="hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PortalBlocks({
  blocks,
  courses,
  organizationSlug,
  signedIn,
  published = false,
}: {
  blocks: PortalBlock[];
  courses: PortalCourse[];
  organizationSlug: string;
  signedIn: boolean;
  published?: boolean;
}) {
  return (
    <div>
      {blocks.map((block) => {
        const config = published
          ? publicBlockConfig(block)
          : blockConfig(block);
        return (
          <PortalBlockSection
            key={block.id}
            type={block.type}
            config={config}
            courses={courses}
            organizationSlug={organizationSlug}
            signedIn={signedIn}
          />
        );
      })}
    </div>
  );
}

function PortalBlockSection({
  type,
  config,
  courses,
  organizationSlug,
  signedIn,
}: {
  type: string;
  config: PortalBlockConfig;
  courses: PortalCourse[];
  organizationSlug: string;
  signedIn: boolean;
}) {
  if (type === "HERO") {
    return (
      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
          <div>
            {config.eyebrow ? (
              <p className="text-sm font-medium text-primary">
                {config.eyebrow}
              </p>
            ) : null}
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight">
              {config.heading}
            </h1>
            {config.body ? (
              <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
                {config.body}
              </p>
            ) : null}
            {config.ctaLabel ? (
              <Button asChild size="lg" className="mt-7">
                <Link
                  href={portalCtaHref(
                    config.ctaHref,
                    organizationSlug,
                    signedIn,
                  )}
                >
                  {signedIn && config.ctaHref === "/sign-in"
                    ? "Continue learning"
                    : config.ctaLabel}
                </Link>
              </Button>
            ) : null}
          </div>
          <div className="rounded-lg border bg-background p-4">
            <div className="space-y-3">
              {(courses.length ? courses.slice(0, 3) : demoCourseRows()).map(
                (course) => (
                  <div
                    key={course.slug}
                    className="flex items-start gap-3 rounded-md border bg-card p-3"
                  >
                    <BookOpen className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{course.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {course.subtitle ?? "Published courses appear here."}
                      </p>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (
    type === "FEATURED_COURSES" ||
    type === "COURSE_CATALOG" ||
    type === "COURSE_COLLECTION"
  ) {
    const limit = config.courseLimit ?? (type === "COURSE_CATALOG" ? 6 : 3);
    const visibleCourses = courses.slice(0, limit);
    return (
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeading config={config} />
        {visibleCourses.length > 0 ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {visibleCourses.map((course) => (
              <CourseCard
                key={course.slug}
                course={{
                  ...course,
                  href: portalCourseHref(organizationSlug, course.slug),
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={GraduationCap}
            title="No published courses yet"
            description="Published organisation courses will appear in this block."
            className="mt-6"
          />
        )}
      </section>
    );
  }

  if (type === "FAQ" || type === "TESTIMONIALS") {
    return (
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeading config={config} />
        <div className="mt-6 space-y-3">
          {(config.items ?? []).map((item) => (
            <div key={item} className="rounded-md border bg-card p-4">
              <p className="text-sm leading-6 text-muted-foreground">{item}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (type === "CTA" || type === "LOGIN_SIGNUP") {
    return (
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-lg border bg-card p-6 sm:p-8">
          <SectionHeading config={config} />
          {config.ctaLabel ? (
            <Button asChild className="mt-6">
              <Link
                href={portalCtaHref(config.ctaHref, organizationSlug, signedIn)}
              >
                {signedIn && config.ctaHref === "/sign-in"
                  ? "Continue learning"
                  : config.ctaLabel}
              </Link>
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading config={config} />
      {config.items?.length ? (
        <ul className="mt-5 space-y-3">
          {config.items.map((item) => (
            <li key={item} className="flex gap-3 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function SectionHeading({ config }: { config: PortalBlockConfig }) {
  return (
    <div>
      {config.eyebrow ? (
        <p className="text-sm font-medium text-primary">{config.eyebrow}</p>
      ) : null}
      {config.heading ? (
        <h2 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight">
          {config.heading}
        </h2>
      ) : null}
      {config.body ? (
        <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
          {config.body}
        </p>
      ) : null}
    </div>
  );
}

export function portalCtaHref(
  href: string | undefined,
  organizationSlug: string,
  signedIn: boolean,
) {
  if (signedIn && (!href || href === "/sign-in" || href === "/sign-up")) {
    return "/dashboard/my-courses";
  }
  return resolvePortalHref(href || "/dashboard", organizationSlug);
}

function resolvePortalHref(href: string, organizationSlug: string) {
  if (href === ".") return `/s/${organizationSlug}`;
  if (href.startsWith("./")) return `/s/${organizationSlug}/${href.slice(2)}`;
  return href;
}

function portalCourseHref(organizationSlug: string, courseSlug: string) {
  return `/s/${organizationSlug}/courses/${courseSlug}`;
}

function demoCourseRows() {
  return [
    {
      title: "Course catalogue",
      slug: "catalogue",
      subtitle: "Showcase courses",
    },
    {
      title: "Learner dashboard",
      slug: "dashboard",
      subtitle: "Resume progress",
    },
    {
      title: "Certificates",
      slug: "certificates",
      subtitle: "Celebrate completion",
    },
  ];
}
