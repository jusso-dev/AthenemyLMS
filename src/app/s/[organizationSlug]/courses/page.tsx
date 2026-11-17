import { CataloguePagination } from "@/components/catalogue-pagination";
import { Input } from "@/components/ui/input";
import { notFound } from "next/navigation";
import { LibraryBig } from "lucide-react";
import { getCurrentAppUser } from "@/lib/auth";
import {
  getPortalCourseCatalogue,
  getPublishedPortal,
  publishedTheme,
} from "@/lib/portal";
import { CourseCard } from "@/components/course-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PortalShell } from "@/components/portal/portal-renderer";

export default async function PortalCataloguePage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { organizationSlug } = await params;
  const [organization, user] = await Promise.all([
    getPublishedPortal(organizationSlug),
    getCurrentAppUser(),
  ]);
  if (!organization?.portal || organization.portal.status !== "PUBLISHED") {
    notFound();
  }
  const search = await searchParams;
  const catalogue = await getPortalCourseCatalogue(
    organization.id,
    search.q,
    search.page,
  );
  const { courses } = catalogue;

  return (
    <PortalShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      theme={publishedTheme(organization.portal)}
      signedIn={Boolean(user)}
    >
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
      >
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">
            Course catalogue
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Browse published courses from {organization.name}.
          </p>
        </div>
        <form className="mt-6 max-w-sm">
          <Input
            type="search"
            name="q"
            aria-label="Search courses"
            placeholder="Search courses"
            defaultValue={search.q}
          />
        </form>
        {courses.length > 0 ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard
                key={course.slug}
                course={{
                  ...course,
                  href: `/s/${organization.slug}/courses/${course.slug}`,
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={LibraryBig}
            title="No published courses"
            description="Published courses from this organisation will appear here."
            className="mt-8"
          />
        )}
        <CataloguePagination
          {...catalogue}
          basePath={`/s/${organization.slug}/courses`}
          query={search.q}
        />
      </main>
    </PortalShell>
  );
}
