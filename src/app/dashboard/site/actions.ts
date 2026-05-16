"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { missingEnv } from "@/lib/env";
import { canManageOrganization } from "@/lib/organizations";
import {
  actionError,
  actionSuccess,
  type ActionFormState,
} from "@/lib/action-state";
import {
  defaultBlockConfig,
  draftTheme,
  editablePortalBlockTypes,
  parseLinksInput,
} from "@/lib/portal";

const themeSchema = z.object({
  portalId: z.string().min(1),
  logoUrl: z.string().url("Use a valid logo URL").optional().or(z.literal("")),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a valid primary color"),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a valid accent color"),
  fontFamily: z.enum(["sans", "serif", "mono"]).default("sans"),
  buttonStyle: z.enum(["rounded", "square", "pill"]).default("rounded"),
  navLinks: z.string().max(2000).optional().or(z.literal("")),
  footerLinks: z.string().max(2000).optional().or(z.literal("")),
});

const pageSchema = z.object({
  pageId: z.string().min(1),
  title: z.string().min(2).max(120),
  seoTitle: z.string().max(140).optional().or(z.literal("")),
  seoDescription: z.string().max(300).optional().or(z.literal("")),
});

const blockSchema = z.object({
  blockId: z.string().min(1),
  eyebrow: z.string().max(80).optional().or(z.literal("")),
  heading: z.string().max(140).optional().or(z.literal("")),
  body: z.string().max(1200).optional().or(z.literal("")),
  ctaLabel: z.string().max(60).optional().or(z.literal("")),
  ctaHref: z.string().max(300).optional().or(z.literal("")),
  courseLimit: z.coerce.number().int().min(1).max(12).default(3),
  items: z.string().max(4000).optional().or(z.literal("")),
});

const addBlockSchema = z.object({
  pageId: z.string().min(1),
  type: z.enum(editablePortalBlockTypes),
});

const moveBlockSchema = z.object({
  blockId: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

const publishSchema = z.object({
  portalId: z.string().min(1),
});

export async function updatePortalThemeFormAction(
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runPortalAction(async () => {
    assertDatabase();
    const parsed = themeSchema.parse({
      portalId: formData.get("portalId"),
      logoUrl: formData.get("logoUrl") ?? "",
      primaryColor: formData.get("primaryColor"),
      accentColor: formData.get("accentColor"),
      fontFamily: formData.get("fontFamily"),
      buttonStyle: formData.get("buttonStyle"),
      navLinks: formData.get("navLinks") ?? "",
      footerLinks: formData.get("footerLinks") ?? "",
    });
    const portal = await requirePortalAdmin(parsed.portalId);

    await prisma.organizationPortal.update({
      where: { id: parsed.portalId },
      data: {
        logoUrl: parsed.logoUrl || null,
        primaryColor: parsed.primaryColor,
        accentColor: parsed.accentColor,
        fontFamily: parsed.fontFamily,
        buttonStyle: parsed.buttonStyle,
        navLinks: parseLinksInput(
          parsed.navLinks ?? "",
          draftTheme(portal).navLinks,
        ),
        footerLinks: parseLinksInput(
          parsed.footerLinks ?? "",
          draftTheme(portal).footerLinks,
        ),
      },
    });

    revalidatePortal(portal.organization.slug);
  }, "Portal theme saved.");
}

export async function updatePortalPageFormAction(
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runPortalAction(async () => {
    assertDatabase();
    const parsed = pageSchema.parse({
      pageId: formData.get("pageId"),
      title: formData.get("title"),
      seoTitle: formData.get("seoTitle") ?? "",
      seoDescription: formData.get("seoDescription") ?? "",
    });
    const page = await requirePageAdmin(parsed.pageId);

    await prisma.portalPage.update({
      where: { id: parsed.pageId },
      data: {
        title: parsed.title,
        seoTitle: parsed.seoTitle || null,
        seoDescription: parsed.seoDescription || null,
      },
    });

    revalidatePortal(page.portal.organization.slug);
  }, "Page settings saved.");
}

export async function updatePortalBlockFormAction(
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runPortalAction(async () => {
    assertDatabase();
    const parsed = blockSchema.parse({
      blockId: formData.get("blockId"),
      eyebrow: formData.get("eyebrow") ?? "",
      heading: formData.get("heading") ?? "",
      body: formData.get("body") ?? "",
      ctaLabel: formData.get("ctaLabel") ?? "",
      ctaHref: formData.get("ctaHref") ?? "",
      courseLimit: formData.get("courseLimit") ?? 3,
      items: formData.get("items") ?? "",
    });
    const block = await requireBlockAdmin(parsed.blockId);

    await prisma.portalBlock.update({
      where: { id: parsed.blockId },
      data: {
        config: {
          eyebrow: parsed.eyebrow || undefined,
          heading: parsed.heading || undefined,
          body: parsed.body || undefined,
          ctaLabel: parsed.ctaLabel || undefined,
          ctaHref: parsed.ctaHref || undefined,
          courseLimit: parsed.courseLimit,
          items: parseItems(parsed.items ?? ""),
        },
      },
    });

    revalidatePortal(block.page.portal.organization.slug);
  }, "Block saved.");
}

export async function addPortalBlockFormAction(
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runPortalAction(async () => {
    assertDatabase();
    const parsed = addBlockSchema.parse({
      pageId: formData.get("pageId"),
      type: formData.get("type"),
    });
    const page = await requirePageAdmin(parsed.pageId);
    const last = await prisma.portalBlock.findFirst({
      where: { pageId: parsed.pageId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    await prisma.portalBlock.create({
      data: {
        pageId: parsed.pageId,
        type: parsed.type,
        position: (last?.position ?? -1) + 1,
        config: defaultBlockConfig(parsed.type),
      },
    });

    revalidatePortal(page.portal.organization.slug);
  }, "Block added.");
}

export async function movePortalBlockFormAction(
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runPortalAction(async () => {
    assertDatabase();
    const parsed = moveBlockSchema.parse({
      blockId: formData.get("blockId"),
      direction: formData.get("direction"),
    });
    const block = await requireBlockAdmin(parsed.blockId);
    const blocks = await prisma.portalBlock.findMany({
      where: { pageId: block.pageId },
      orderBy: { position: "asc" },
      select: { id: true, position: true },
    });
    const index = blocks.findIndex((item) => item.id === block.id);
    const targetIndex = parsed.direction === "up" ? index - 1 : index + 1;
    const target = blocks[targetIndex];
    if (!target) return;

    await prisma.$transaction([
      prisma.portalBlock.update({
        where: { id: block.id },
        data: { position: target.position },
      }),
      prisma.portalBlock.update({
        where: { id: target.id },
        data: { position: block.position },
      }),
    ]);

    revalidatePortal(block.page.portal.organization.slug);
  }, "Block order updated.");
}

export async function publishPortalFormAction(
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runPortalAction(async () => {
    assertDatabase();
    const parsed = publishSchema.parse({ portalId: formData.get("portalId") });
    const portal = await requirePortalAdmin(parsed.portalId);
    const now = new Date();
    const theme = draftTheme(portal);

    await prisma.$transaction(async (tx) => {
      await tx.organizationPortal.update({
        where: { id: portal.id },
        data: {
          status: "PUBLISHED",
          publishedAt: now,
          publishedTheme: theme,
        },
      });
      for (const page of portal.pages) {
        await tx.portalPage.update({
          where: { id: page.id },
          data: {
            status: "PUBLISHED",
            publishedAt: now,
            publishedTitle: page.title,
            publishedSeoTitle: page.seoTitle,
            publishedSeoDescription: page.seoDescription,
          },
        });
        for (const block of page.blocks) {
          await tx.portalBlock.update({
            where: { id: block.id },
            data: {
              publishedAt: now,
              publishedConfig: block.config ?? {},
            },
          });
        }
      }
    });

    revalidatePortal(portal.organization.slug);
  }, "Portal published.");
}

async function requirePortalAdmin(portalId: string) {
  const user = await requireAppUser();
  const portal = await prisma.organizationPortal.findUnique({
    where: { id: portalId },
    include: {
      organization: true,
      pages: { include: { blocks: { orderBy: { position: "asc" } } } },
    },
  });
  if (!portal) throw new Error("Portal not found.");
  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: portal.organizationId,
        userId: user.id,
      },
    },
  });
  if (!canManageOrganization(user, membership)) {
    throw new Error("Organisation admin access is required.");
  }
  return portal;
}

async function requirePageAdmin(pageId: string) {
  const page = await prisma.portalPage.findUnique({
    where: { id: pageId },
    include: { portal: { include: { organization: true } } },
  });
  if (!page) throw new Error("Portal page not found.");
  await requirePortalAdmin(page.portalId);
  return page;
}

async function requireBlockAdmin(blockId: string) {
  const block = await prisma.portalBlock.findUnique({
    where: { id: blockId },
    include: {
      page: { include: { portal: { include: { organization: true } } } },
    },
  });
  if (!block) throw new Error("Portal block not found.");
  await requirePortalAdmin(block.page.portalId);
  return block;
}

function assertDatabase() {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    throw new Error(
      "Supabase is not configured. Add DATABASE_URL to .env.local.",
    );
  }
}

async function runPortalAction(
  operation: () => Promise<void>,
  successMessage: string,
): Promise<ActionFormState> {
  try {
    await operation();
    return actionSuccess(successMessage);
  } catch (error) {
    return actionError(error);
  }
}

function parseItems(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function revalidatePortal(organizationSlug: string) {
  revalidatePath("/dashboard/site");
  revalidatePath(`/s/${organizationSlug}`);
  revalidatePath(`/s/${organizationSlug}/courses`);
  revalidatePath(`/s/${organizationSlug}/home`);
}
