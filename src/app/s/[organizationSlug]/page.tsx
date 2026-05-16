import { notFound } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth";
import {
  getPortalCourses,
  getPortalPage,
  getPublishedPortal,
  publishedTheme,
} from "@/lib/portal";
import { PortalBlocks, PortalShell } from "@/components/portal/portal-renderer";

export default async function PortalHomePage({
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
  const page = getPortalPage(organization.portal, "HOME");
  if (!page) notFound();

  const courses = await getPortalCourses(organization.id, 6);

  return (
    <PortalShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      theme={publishedTheme(organization.portal)}
      signedIn={Boolean(user)}
    >
      <main>
        <PortalBlocks
          blocks={page.blocks}
          courses={courses}
          organizationSlug={organization.slug}
          signedIn={Boolean(user)}
          published
        />
      </main>
    </PortalShell>
  );
}
