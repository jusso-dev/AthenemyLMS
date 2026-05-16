import { notFound } from "next/navigation";
import { LibraryBig } from "lucide-react";
import { getCurrentAppUser } from "@/lib/auth";
import {
  getPortalCourses,
  getPublishedPortal,
  publishedTheme,
} from "@/lib/portal";
import { CourseCard } from "@/components/course-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PortalShell } from "@/components/portal/portal-renderer";

export default async function PortalCataloguePage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const [organization, user] = await Promise.all([
    getPublishedPortal(organizationSlug),
    getCurrentAppUser(),
  ]);
  if (!organization?.portal || organization.portal.status !== "PUBLISHED") {
    notFound();
  }
  const courses = await getPortalCourses(organization.id);

  return (
    <PortalShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      theme={publishedTheme(organization.portal)}
      signedIn={Boolean(user)}
    >
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">
            Course catalogue
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Browse published courses from {organization.name}.
          </p>
        </div>
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
      </main>
    </PortalShell>
  );
}
