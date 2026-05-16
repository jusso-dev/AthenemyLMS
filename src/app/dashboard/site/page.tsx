import Link from "next/link";
import type * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Globe2,
  Images,
  LayoutTemplate,
  Plus,
  Save,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { Textarea } from "@/components/ui/textarea";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { PortalBlocks, PortalShell } from "@/components/portal/portal-renderer";
import { PortalStudio } from "@/components/portal/portal-studio";
import {
  GalleryLibraryField,
  MediaLibraryField,
  type PortalAssetOption,
} from "@/components/portal/media-library-field";
import {
  addPortalBlockFormAction,
  applyPortalTemplateFormAction,
  movePortalBlockFormAction,
  publishPortalFormAction,
  reorderPortalBlockFormAction,
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
  portalTemplatePresets,
} from "@/lib/portal";
import type { Prisma, PortalBlockType } from "@prisma/client";

export default async function DashboardSitePage() {
  const hasDatabase = databaseIsConfigured();
  const user = await getCurrentAppUser();
  const { organization, portal, courses, assets } =
    await getPortalBuilderData(user);
  const homePage = getPortalPage(portal, "HOME");
  const theme = portal ? draftTheme(portal) : null;
  const studioBlocks =
    homePage?.blocks.map((block, index) => {
      const config = blockConfig(block);
      return {
        id: block.id,
        label: portalBlockLabels[block.type],
        summary:
          config.heading ||
          config.body ||
          `${portalBlockLabels[block.type]} block`,
        position: index,
      };
    }) ?? [];

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

          <PortalStudio
            blocks={studioBlocks}
            statusLabel={portal.status === "PUBLISHED" ? "Published" : "Draft"}
            publicHref={`/s/${organization.slug}`}
            reorderAction={reorderPortalBlockFormAction}
            moveAction={movePortalBlockFormAction}
            addBlock={
              <ActionForm
                action={addPortalBlockFormAction}
                className="grid gap-3 rounded-md border bg-muted/20 p-4"
              >
                <input type="hidden" name="pageId" value={homePage.id} />
                <label className="grid gap-2 text-sm font-medium">
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
                <PendingSubmitButton variant="outline" className="w-fit">
                  <Plus className="h-4 w-4" />
                  Add block
                </PendingSubmitButton>
              </ActionForm>
            }
            pageSettings={
              <div className="space-y-4">
                <TemplatePicker pageId={homePage.id} />
                <ActionForm
                  action={updatePortalPageFormAction}
                  className="grid gap-4 rounded-md border bg-muted/20 p-4"
                >
                  <input type="hidden" name="pageId" value={homePage.id} />
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
              </div>
            }
            themeSettings={
              <ActionForm
                action={updatePortalThemeFormAction}
                className="grid gap-4 rounded-md border bg-muted/20 p-4"
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
                <div className="grid grid-cols-2 gap-3">
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
                  <label className="grid gap-2 text-sm font-medium">
                    Default theme
                    <select
                      name="themeMode"
                      defaultValue={theme.themeMode}
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="system">System</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </label>
                </div>
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
            }
            publishPanel={
              <div className="rounded-md border bg-muted/20 p-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  Publishing copies the current draft theme and block settings
                  to the public portal.
                </p>
                <ActionForm action={publishPortalFormAction} className="mt-4">
                  <input type="hidden" name="portalId" value={portal.id} />
                  <PendingSubmitButton>
                    <Send className="h-4 w-4" />
                    Publish portal
                  </PendingSubmitButton>
                </ActionForm>
              </div>
            }
            blockEditors={homePage.blocks.map((block, index) => ({
              id: block.id,
              node: (
                <BlockEditor
                  key={block.id}
                  block={block}
                  index={index}
                  total={homePage.blocks.length}
                  organizationId={organization.id}
                  assets={assets}
                />
              ),
            }))}
            desktopPreview={
              <PortalShell
                organizationName={organization.name}
                organizationSlug={organization.slug}
                theme={theme}
                signedIn
              >
                <PortalBlocks
                  blocks={homePage.blocks}
                  courses={courses}
                  organizationSlug={organization.slug}
                  signedIn
                />
              </PortalShell>
            }
            mobilePreview={
              <PortalShell
                organizationName={organization.name}
                organizationSlug={organization.slug}
                theme={theme}
                signedIn
                viewport="mobile-preview"
              >
                <PortalBlocks
                  blocks={homePage.blocks}
                  courses={courses}
                  organizationSlug={organization.slug}
                  signedIn
                  viewport="mobile-preview"
                />
              </PortalShell>
            }
          />
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
  organizationId,
  assets,
}: {
  block: {
    id: string;
    type: PortalBlockType;
    config: Prisma.JsonValue;
  };
  index: number;
  total: number;
  organizationId: string;
  assets: PortalAssetOption[];
}) {
  const config = blockConfig(block);
  const isImageBlock = block.type === "IMAGE" || block.type === "IMAGE_TEXT";
  const isGalleryBlock = block.type === "GALLERY";
  const isCourseBlock =
    block.type === "FEATURED_COURSES" ||
    block.type === "COURSE_CATALOG" ||
    block.type === "COURSE_COLLECTION";
  const supportsCta =
    block.type === "HERO" ||
    block.type === "CTA" ||
    block.type === "LOGIN_SIGNUP" ||
    block.type === "IMAGE" ||
    block.type === "IMAGE_TEXT";

  return (
    <div className="space-y-4">
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
      <ActionForm action={updatePortalBlockFormAction} className="grid gap-4">
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
        {isImageBlock ? (
          <div className="grid gap-3 rounded-md border bg-background p-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Images className="h-4 w-4 text-muted-foreground" />
                Image
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Upload an image, reuse one from this organisation, or paste a
                public URL as a fallback.
              </p>
            </div>
            <MediaLibraryField
              organizationId={organizationId}
              assets={assets}
              imageUrlName="imageUrl"
              imageAltName="imageAlt"
              imageCaptionName="imageCaption"
              defaultUrl={config.imageUrl ?? ""}
              defaultAlt={config.imageAlt ?? ""}
              defaultCaption={config.imageCaption ?? ""}
            />
            <label className="grid gap-2 text-sm font-medium">
              Layout
              <select
                name="imageLayout"
                defaultValue={config.imageLayout ?? "right"}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="right">Text left, image right</option>
                <option value="left">Image left, text right</option>
                <option value="banner">Full-width image</option>
              </select>
            </label>
          </div>
        ) : null}
        {isGalleryBlock ? (
          <div className="grid gap-3 rounded-md border bg-background p-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Images className="h-4 w-4 text-muted-foreground" />
                Gallery images
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Add, remove, reorder, caption, and describe gallery images.
              </p>
            </div>
            <GalleryLibraryField
              organizationId={organizationId}
              assets={assets}
              name="images"
              defaultImages={config.images ?? []}
            />
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px]">
          {supportsCta ? (
            <>
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
            </>
          ) : (
            <>
              <input
                type="hidden"
                name="ctaLabel"
                value={config.ctaLabel ?? ""}
              />
              <input
                type="hidden"
                name="ctaHref"
                value={config.ctaHref ?? ""}
              />
            </>
          )}
          {isCourseBlock ? (
            <LabeledInput
              label="Course limit"
              name="courseLimit"
              type="number"
              min={1}
              max={12}
              defaultValue={String(config.courseLimit ?? 3)}
            />
          ) : (
            <input
              type="hidden"
              name="courseLimit"
              value={String(config.courseLimit ?? 3)}
            />
          )}
        </div>
        {!isGalleryBlock ? (
          <LabeledTextarea
            label="List items"
            name="items"
            defaultValue={(config.items ?? []).join("\n")}
            rows={4}
            hint="One FAQ, testimonial, or bullet per line."
          />
        ) : null}
        <PendingSubmitButton className="w-fit" variant="outline">
          Save block
        </PendingSubmitButton>
      </ActionForm>
    </div>
  );
}

function TemplatePicker({ pageId }: { pageId: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <div>
        <h3 className="text-sm font-semibold">Homepage templates</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Replace the current homepage draft with a standard LMS layout.
        </p>
      </div>
      <div className="mt-4 grid gap-3">
        {portalTemplatePresets.map((template) => (
          <ActionForm
            key={template.id}
            action={applyPortalTemplateFormAction}
            inlineMessage={false}
            className="rounded-md border bg-background p-3"
          >
            <input type="hidden" name="pageId" value={pageId} />
            <input type="hidden" name="templateId" value={template.id} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium">{template.name}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {template.description}
                </p>
              </div>
              <PendingSubmitButton
                variant="outline"
                size="sm"
                pendingLabel="Applying..."
                className="w-fit shrink-0"
              >
                Apply
              </PendingSubmitButton>
            </div>
          </ActionForm>
        ))}
      </div>
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
