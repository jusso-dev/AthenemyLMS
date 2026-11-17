import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCurrentAppUser } from "@/lib/auth";
import { missingEnv } from "@/lib/env";

// Evaluate authentication and setup state per request, even when builds omit secrets.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (missingEnv(["DATABASE_URL"]).length === 0) {
    const user = await getCurrentAppUser();
    if (user?.organizationMembershipCount === 0) {
      redirect("/onboarding/organization");
    }
  }

  return <DashboardShell>{children}</DashboardShell>;
}
