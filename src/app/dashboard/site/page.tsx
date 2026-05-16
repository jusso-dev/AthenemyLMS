import Link from "next/link";
import type * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  Globe2,
  LayoutTemplate,
  Plus,
  Save,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { Textarea } from "@/components/ui/textarea";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { PortalBlocks } from "@/components/portal/portal-renderer";
import {
  addPortalBlockFormAction,
  movePortalBlockFormAction,
  publishPortalFormAction,
  updatePortalBlockFormAction,
  updatePortalPageFormAction,
  updatePortalThemeFormAction,
} from "@/app/dashboard/site/actions";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackNotice, databaseIsConfigured } from "@/lib/dashboard-data";
import { SetupMessage } from "@/lib/setup-message";
import {
  blockConfig,
  draftTheme,
  editablePortalBlockTypes,
  getPortalBuilderData,
  getPortalPage,
  linksToTextarea,
  portalBlockLabels,
} from "@/lib/portal";
import type { Prisma, PortalBlockType } from "@prisma/client";

export default async function DashboardSitePage() {
  const hasDatabase = databaseIsConfigured();
  const user = await getCurrentAppUser();
  const { organization, portal, courses } = await getPortalBuilderData(user);
  const homePage = getPortalPage(portal, "HOME");
  const theme = portal ? draftTheme(portal) : null;

  return (
    <div className="max-w-7xl space-y-6">
      {!hasDatabase ? <SetupMessage {...fallbackNotice()} /> : null}
      <PageHeader
        title="Portal"
        description="Build the public school website learners see before and after sign-in."
        actions={
          portal && organization ? (
            <Button asChild variant="outline">
              <Link href={`/s/${organization.slug}`}>
                <Globe2 className="h-4 w-4" />
                Public portal
              </Link>
            </Button>
          ) : null
        }
      />

      {!organization || !portal || !homePage || !theme ? (
        <EmptyState
          icon={LayoutTemplate}
          title="Create an organisation first"
          description="Portal builder access is available to organisation owners and admins."
        />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <StatusCard
              label="Portal status"
              value={portal.status === "PUBLISHED" ? "Published" : "Draft"}
            />
            <StatusCard
              label="Homepage blocks"
              value={homePage.blocks.length}
            />
            <StatusCard label="Published courses" value={courses.length} />
            <StatusCard
              label="Last published"
              value={
                portal.publishedAt
                  ? portal.publishedAt.toLocaleDateString("en", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Not yet"
              }
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <aside className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Theme</CardTitle>
                </CardHeader>
                <CardContent>
                  <ActionForm
                    action={updatePortalThemeFormAction}
                    className="grid gap-4"
                  >
                    <input type="hidden" name="portalId" value={portal.id} />
                    <LabeledInput
                      label="Logo URL"
                      name="logoUrl"
                      defaultValue={theme.logoUrl ?? ""}
                      placeholder="https://..."
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <label className="grid gap-2 text-sm font-medium">
                        Primary
                        <Input
                          aria-label="Primary color"
                          name="primaryColor"
                          type="color"
                          defaultValue={theme.primaryColor}
                          className="h-10 p-1"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium">
                        Accent
                        <Input
                          aria-label="Accent color"
                          name="accentColor"
                          type="color"
                          defaultValue={theme.accentColor}
                          className="h-10 p-1"
                        />
                      </label>
                    </div>
                    <label className="grid gap-2 text-sm font-medium">
                      Font
                      <select
                        name="fontFamily"
                        defaultValue={theme.fontFamily}
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="sans">Sans</option>
                        <option value="serif">Serif</option>
                        <option value="mono">Mono</option>
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-medium">
                      Button style
                      <select
                        name="buttonStyle"
                        defaultValue={theme.buttonStyle}
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="rounded">Rounded</option>
                        <option value="square">Square</option>
                        <option value="pill">Pill</option>
                      </select>
                    </label>
                    <LabeledTextarea
                      label="Navigation links"
                      name="navLinks"
                      rows={4}
                      defaultValue={linksToTextarea(theme.navLinks)}
                      hint="One per line: Label|/path"
                    />
                    <LabeledTextarea
                      label="Footer links"
                      name="footerLinks"
                      rows={3}
                      defaultValue={linksToTextarea(theme.footerLinks)}
                      hint="One per line: Label|/path"
                    />
                    <PendingSubmitButton>
                      <Save className="h-4 w-4" />
                      Save theme
                    </PendingSubmitButton>
                  </ActionForm>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Publish</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Publishing copies the current draft theme and block settings
                    to the public portal.
                  </p>
                  <ActionForm action={publishPortalFormAction}>
                    <input type="hidden" name="portalId" value={portal.id} />
                    <PendingSubmitButton>
                      <Send className="h-4 w-4" />
                      Publish portal
                    </PendingSubmitButton>
                  </ActionForm>
                </CardContent>
              </Card>
            </aside>

            <main className="space-y-6">
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Homepage</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Edit focused LMS blocks, then publish when ready.
                    </p>
                  </div>
                  <Badge
                    variant={
                      homePage.status === "PUBLISHED" ? "success" : "outline"
                    }
                  >
                    {homePage.status === "PUBLISHED" ? "Public" : "Draft"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ActionForm
                    action={updatePortalPageFormAction}
                    className="grid gap-4 rounded-md border bg-muted/20 p-4"
                  >
                    <input type="hidden" name="pageId" value={homePage.id} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <LabeledInput
                        label="Page title"
                        name="title"
                        defaultValue={homePage.title}
                      />
                      <LabeledInput
                        label="SEO title"
                        name="seoTitle"
                        defaultValue={homePage.seoTitle ?? ""}
                      />
                    </div>
                    <LabeledTextarea
                      label="SEO description"
                      name="seoDescription"
                      defaultValue={homePage.seoDescription ?? ""}
                      rows={2}
                    />
                    <PendingSubmitButton className="w-fit">
                      Save page
                    </PendingSubmitButton>
                  </ActionForm>

                  <ActionForm
                    action={addPortalBlockFormAction}
                    className="flex flex-col gap-3 rounded-md border bg-muted/20 p-4 sm:flex-row sm:items-end"
                  >
                    <input type="hidden" name="pageId" value={homePage.id} />
                    <label className="grid flex-1 gap-2 text-sm font-medium">
                      Add block
                      <select
                        name="type"
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                      >
                        {editablePortalBlockTypes.map((type) => (
                          <option key={type} value={type}>
                            {portalBlockLabels[type]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <PendingSubmitButton variant="outline">
                      <Plus className="h-4 w-4" />
                      Add
                    </PendingSubmitButton>
                  </ActionForm>

                  <div className="space-y-4">
                    {homePage.blocks.map((block, index) => (
                      <BlockEditor
                        key={block.id}
                        block={block}
                        index={index}
                        total={homePage.blocks.length}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Preview</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Desktop and mobile frames use the draft blocks.
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/s/${organization.slug}`}>
                      <Eye className="h-4 w-4" />
                      Published view
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-5 xl:grid-cols-[1fr_360px]">
                  <div className="overflow-hidden rounded-md border">
                    <PortalBlocks
                      blocks={homePage.blocks}
                      courses={courses}
                      organizationSlug={organization.slug}
                      signedIn
                    />
                  </div>
                  <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[2rem] border-8 border-foreground/80 bg-background">
                    <PortalBlocks
                      blocks={homePage.blocks}
                      courses={courses}
                      organizationSlug={organization.slug}
                      signedIn
                    />
                  </div>
                </CardContent>
              </Card>
            </main>
          </div>
        </>
      )}
    </div>
  );
}

function StatusCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function BlockEditor({
  block,
  index,
  total,
}: {
  block: {
    id: string;
    type: PortalBlockType;
    config: Prisma.JsonValue;
  };
  index: number;
  total: number;
}) {
  const config = blockConfig(block);

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">{portalBlockLabels[block.type]}</p>
          <p className="text-sm text-muted-foreground">Block {index + 1}</p>
        </div>
        <div className="flex gap-2">
          <MoveButton
            blockId={block.id}
            direction="up"
            disabled={index === 0}
          />
          <MoveButton
            blockId={block.id}
            direction="down"
            disabled={index === total - 1}
          />
        </div>
      </div>
      <ActionForm
        action={updatePortalBlockFormAction}
        className="mt-4 grid gap-4"
      >
        <input type="hidden" name="blockId" value={block.id} />
        <div className="grid gap-3 md:grid-cols-2">
          <LabeledInput
            label="Eyebrow"
            name="eyebrow"
            defaultValue={config.eyebrow ?? ""}
          />
          <LabeledInput
            label="Heading"
            name="heading"
            defaultValue={config.heading ?? ""}
          />
        </div>
        <LabeledTextarea
          label="Body"
          name="body"
          defaultValue={config.body ?? ""}
          rows={3}
        />
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px]">
          <LabeledInput
            label="CTA label"
            name="ctaLabel"
            defaultValue={config.ctaLabel ?? ""}
          />
          <LabeledInput
            label="CTA URL"
            name="ctaHref"
            defaultValue={config.ctaHref ?? ""}
          />
          <LabeledInput
            label="Course limit"
            name="courseLimit"
            type="number"
            min={1}
            max={12}
            defaultValue={String(config.courseLimit ?? 3)}
          />
        </div>
        <LabeledTextarea
          label="List items"
          name="items"
          defaultValue={(config.items ?? []).join("\n")}
          rows={4}
          hint="One FAQ, testimonial, or bullet per line."
        />
        <PendingSubmitButton className="w-fit" variant="outline">
          Save block
        </PendingSubmitButton>
      </ActionForm>
    </div>
  );
}

function MoveButton({
  blockId,
  direction,
  disabled,
}: {
  blockId: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  return (
    <ActionForm action={movePortalBlockFormAction} inlineMessage={false}>
      <input type="hidden" name="blockId" value={blockId} />
      <input type="hidden" name="direction" value={direction} />
      <PendingSubmitButton
        variant="outline"
        size="icon"
        disabled={disabled}
        aria-label={direction === "up" ? "Move block up" : "Move block down"}
      >
        {direction === "up" ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </PendingSubmitButton>
    </ActionForm>
  );
}

function LabeledInput({
  label,
  ...props
}: React.ComponentProps<typeof Input> & { label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <Input {...props} />
    </label>
  );
}

function LabeledTextarea({
  label,
  hint,
  ...props
}: React.ComponentProps<typeof Textarea> & { label: string; hint?: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <Textarea {...props} />
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}
