import Link from "next/link";
import { LibraryBig, Search } from "lucide-react";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { enableCourseTemplateFormAction } from "@/app/dashboard/courses/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentAppUser } from "@/lib/auth";
import { databaseIsConfigured, fallbackNotice } from "@/lib/dashboard-data";
import { defaultCourseTemplates } from "@/lib/course-templates";
import { prisma } from "@/lib/prisma";
import { SetupMessage } from "@/lib/setup-message";

export default async function CourseTemplateLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    category?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.toLowerCase();
  const category = Array.isArray(params.category)
    ? params.category[0]
    : params.category;
  const hasDatabase = databaseIsConfigured();
  const user = await getCurrentAppUser();
  const memberships =
    hasDatabase && user
      ? await prisma.organizationMembership.findMany({
          where: { userId: user.id },
          include: { organization: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
  const enabled =
    hasDatabase && memberships.length > 0
      ? await prisma.course.findMany({
          where: {
            organizationId: {
              in: memberships.map((item) => item.organizationId),
            },
            sourceTemplateId: { not: null },
          },
          select: { sourceTemplateId: true, organizationId: true },
        })
      : [];
  const categories = [
    ...new Set(defaultCourseTemplates.map((item) => item.category)),
  ];
  const templates = defaultCourseTemplates.filter((template) => {
    const matchesQuery =
      !q ||
      [template.title, template.summary, template.category, ...template.tags]
        .join(" ")
        .toLowerCase()
        .includes(q);
    const matchesCategory = !category || template.category === category;
    return matchesQuery && matchesCategory;
  });
  const primaryOrg = memberships[0]?.organization;

  return (
    <div className="space-y-8">
      {!hasDatabase ? <SetupMessage {...fallbackNotice()} /> : null}
      <PageHeader
        title="Default course library"
        description="Enable editable starter courses for common training needs."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/courses">Manage courses</Link>
          </Button>
        }
      />
      <form className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search templates"
            type="search"
            name="q"
            placeholder="Search templates"
            defaultValue={q}
            className="pl-9"
          />
        </div>
        <select
          name="category"
          defaultValue={category ?? ""}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <Button variant="outline">Filter</Button>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        {templates.map((template) => {
          const enabledForOrg = enabled.some(
            (course) =>
              course.sourceTemplateId === template.id &&
              course.organizationId === primaryOrg?.id,
          );

          return (
            <Card key={template.id}>
              <CardContent className="space-y-5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">
                        {template.title}
                      </h2>
                      <Badge variant="outline">{template.category}</Badge>
                      {enabledForOrg ? (
                        <Badge variant="success">Enabled</Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {template.summary}
                    </p>
                  </div>
                  <LibraryBig className="h-5 w-5 shrink-0 text-primary" />
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-sm font-medium">Outline</p>
                  <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {template.lessons.slice(0, 5).map((lesson) => (
                      <li key={lesson.title}>{lesson.title}</li>
                    ))}
                  </ol>
                </div>
                <ActionForm
                  action={enableCourseTemplateFormAction}
                  className="grid gap-3 rounded-md border p-3"
                >
                  <input type="hidden" name="templateId" value={template.id} />
                  <input
                    type="hidden"
                    name="organizationId"
                    value={primaryOrg?.id ?? ""}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="required"
                      defaultChecked={template.requiredSuggestion}
                      disabled={!primaryOrg || !hasDatabase}
                    />
                    Required for members
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="autoEnrollExisting"
                      defaultChecked
                      disabled={!primaryOrg || !hasDatabase}
                    />
                    Auto-enroll current members
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="autoEnrollFuture"
                      defaultChecked
                      disabled={!primaryOrg || !hasDatabase}
                    />
                    Auto-enroll future members
                  </label>
                  <PendingSubmitButton
                    className="w-fit"
                    disabled={!primaryOrg || !hasDatabase}
                  >
                    Enable editable copy
                  </PendingSubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
