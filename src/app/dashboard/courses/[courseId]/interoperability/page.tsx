import Link from "next/link";
import { notFound } from "next/navigation";
import type * as React from "react";
import { Box, FileArchive, PlugZap, RadioTower, Upload } from "lucide-react";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { CourseManagementNav } from "@/components/courses/course-management-nav";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { uploadScormPackageFormAction } from "@/app/dashboard/courses/actions";
import { getCurrentAppUser } from "@/lib/auth";
import { databaseIsConfigured, fallbackNotice } from "@/lib/dashboard-data";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { SetupMessage } from "@/lib/setup-message";

export default async function InteroperabilityPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const databaseReady = databaseIsConfigured();
  const user = await getCurrentAppUser();
  const course = databaseReady
    ? await prisma.course.findUnique({
        where: { id: courseId },
        include: {
          sections: {
            orderBy: { position: "asc" },
            include: {
              lessons: {
                orderBy: { position: "asc" },
                select: { id: true, title: true },
              },
            },
          },
          externalPackages: {
            orderBy: { createdAt: "desc" },
            include: {
              lesson: { select: { title: true } },
              _count: { select: { attempts: true } },
            },
          },
        },
      })
    : null;

  if (databaseReady && !course) notFound();
  const allowed = canManageCourse(user, course);
  const lessons = course?.sections.flatMap((section) => section.lessons) ?? [];

  return (
    <div className="space-y-6">
      {!databaseReady ? <SetupMessage {...fallbackNotice()} /> : null}
      <PageHeader
        eyebrow={course?.title ?? "Course"}
        title="Interoperability"
        description="Register SCORM packages now, with xAPI and LTI foundations ready for tracked runtime expansion."
      />
      <CourseManagementNav courseId={courseId} />
      {!course || !allowed ? (
        <Card>
          <CardContent className="pt-6">
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Instructor or admin access is required to manage interoperability.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileArchive className="h-5 w-5" />
                  Upload SCORM 1.2
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm
                  action={uploadScormPackageFormAction.bind(null, course.id)}
                  className="grid gap-4"
                >
                  <label className="grid gap-2 text-sm font-medium">
                    Package file
                    <Input
                      name="packageFile"
                      type="file"
                      accept=".zip,application/zip"
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Attach to lesson
                    <select
                      name="lessonId"
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                      defaultValue=""
                    >
                      <option value="">Course-level package</option>
                      {lessons.map((lesson) => (
                        <option key={lesson.id} value={lesson.id}>
                          {lesson.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <PendingSubmitButton
                    className="w-fit"
                    pendingLabel="Parsing..."
                  >
                    <Upload className="h-4 w-4" />
                    Register package
                  </PendingSubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Registered packages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {course.externalPackages.length === 0 ? (
                  <EmptyState
                    icon={Box}
                    title="No external packages"
                    description="SCORM packages attached to this course will appear here with launch and attempt status."
                  />
                ) : null}
                {course.externalPackages.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.title}</p>
                        <Badge variant="outline">{item.type}</Badge>
                        <Badge
                          variant={
                            item.status === "READY" ? "success" : "outline"
                          }
                        >
                          {item.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.lesson?.title
                          ? `Attached to ${item.lesson.title}`
                          : "Course-level package"}{" "}
                        · {item._count.attempts} attempts
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Launch path: {item.launchPath ?? "Not set"}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/dashboard/learn/${course.id}/scorm/${item.id}`}
                      >
                        Launch test
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </main>
          <aside className="space-y-4">
            <FoundationCard
              icon={FileArchive}
              title="SCORM foundation"
              text="SCORM 1.2 manifests are parsed and stored with course or lesson assignments. Runtime tracking primitives are available for completion, score, time, and suspend data."
            />
            <FoundationCard
              icon={RadioTower}
              title="xAPI foundation"
              text="The attempt model can store statement snapshots. A dedicated xAPI ingestion endpoint and optional LRS forwarding are next."
            />
            <FoundationCard
              icon={PlugZap}
              title="LTI foundation"
              text="The package model reserves LTI tool records. Signing, launch claims, and tool assignment security remain behind the documented boundary."
            />
          </aside>
        </div>
      )}
    </div>
  );
}

function FoundationCard({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-md border bg-card p-4">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}
