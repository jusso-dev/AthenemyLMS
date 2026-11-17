import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAppUser } from "@/lib/auth";
import { databaseIsConfigured } from "@/lib/dashboard-data";
import { prisma } from "@/lib/prisma";
import { authorizeScormPackage, ScormAccessError } from "@/lib/scorm-runtime";
import { ScormLauncher } from "./scorm-player";

export default async function ScormLaunchPage({
  params,
}: {
  params: Promise<{ courseId: string; packageId: string }>;
}) {
  const { courseId, packageId } = await params;
  const user = await getCurrentAppUser();
  if (!databaseIsConfigured() || !user) notFound();
  const item = await prisma.externalPackage.findUnique({
    where: { id: packageId },
    select: { courseId: true },
  });
  if (!item || item.courseId !== courseId) notFound();
  let launch;
  try {
    launch = await authorizeScormPackage(prisma, packageId, user.id);
  } catch (error) {
    if (error instanceof ScormAccessError) notFound();
    throw error;
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="outline" size="sm">
        <a href={`/dashboard/learn/${courseId}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to course
        </a>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{launch.item.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ScormLauncher packageId={packageId} />
        </CardContent>
      </Card>
    </div>
  );
}
