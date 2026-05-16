import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAppUser } from "@/lib/auth";
import { databaseIsConfigured } from "@/lib/dashboard-data";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function ScormLaunchPage({
  params,
}: {
  params: Promise<{ courseId: string; packageId: string }>;
}) {
  const { courseId, packageId } = await params;
  const user = await getCurrentAppUser();
  const databaseReady = databaseIsConfigured();
  const item = databaseReady
    ? await prisma.externalPackage.findUnique({
        where: { id: packageId },
        include: { course: true, lesson: true },
      })
    : null;

  if (databaseReady && (!item || item.courseId !== courseId)) notFound();

  const enrollment =
    user && item
      ? await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: user.id, courseId } },
        })
      : null;
  const allowed = item
    ? canManageCourse(user, item.course) || enrollment
    : false;
  if (databaseReady && item && !allowed) notFound();

  if (user && item) {
    await prisma.externalPackageAttempt.upsert({
      where: { packageId_userId: { packageId: item.id, userId: user.id } },
      create: {
        packageId: item.id,
        userId: user.id,
        courseId,
        lessonId: item.lessonId,
        completionStatus: "launched",
      },
      update: { completionStatus: "launched" },
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="outline" size="sm">
        <Link href={`/dashboard/learn/${courseId}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to course
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{item?.title ?? "SCORM package"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Secure launch checkpoint</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Access is verified against course management or learner
                  enrollment before package launch. The full SCORM runtime frame
                  will mount here once extracted package hosting is enabled.
                </p>
              </div>
            </div>
          </div>
          <dl className="grid gap-3 rounded-md border p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Launch path</dt>
              <dd className="mt-1 font-medium">
                {item?.launchPath ?? "Unset"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Lesson</dt>
              <dd className="mt-1 font-medium">
                {item?.lesson?.title ?? "Course-level package"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
