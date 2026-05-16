import {
  Prisma,
  type PortalBlockType,
  type PortalPageType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { missingEnv } from "@/lib/env";
import type { AppUser } from "@/lib/auth";
import { canManageOrganization } from "@/lib/organizations";

export type PortalLink = {
  label: string;
  href: string;
};

export type PortalBlockConfig = {
  eyebrow?: string;
  heading?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  courseLimit?: number;
  items?: string[];
};

export type PortalTheme = {
  logoUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  buttonStyle: string;
  themeMode: "system" | "light" | "dark";
  navLinks: PortalLink[];
  footerLinks: PortalLink[];
};

export const portalPageLabels: Record<PortalPageType, string> = {
  HOME: "Homepage",
  CATALOG: "Catalogue",
  COURSE_TEMPLATE: "Course pages",
  AFTER_LOGIN: "Learner home",
  CUSTOM: "Custom page",
};

export const portalBlockLabels: Record<PortalBlockType, string> = {
  HERO: "Hero",
  FEATURED_COURSES: "Featured courses",
  COURSE_CATALOG: "Course catalogue",
  RICH_TEXT: "Rich text",
  IMAGE_TEXT: "Image and text",
  INSTRUCTOR_PROFILE: "Instructor profile",
  TESTIMONIALS: "Testimonials",
  FAQ: "FAQ",
  CTA: "Call to action",
  PRICING: "Pricing",
  LOGIN_SIGNUP: "Login and signup",
  RESUME_LEARNING: "Resume learning",
  REQUIRED_WORK: "Required work",
  COURSE_COLLECTION: "Course collection",
};

export const editablePortalBlockTypes = [
  "HERO",
  "FEATURED_COURSES",
  "COURSE_CATALOG",
  "RICH_TEXT",
  "INSTRUCTOR_PROFILE",
  "TESTIMONIALS",
  "FAQ",
  "CTA",
  "LOGIN_SIGNUP",
] as const satisfies readonly [PortalBlockType, ...PortalBlockType[]];

export const portalInclude = {
  organization: true,
  pages: {
    orderBy: { createdAt: "asc" as const },
    include: {
      blocks: { orderBy: { position: "asc" as const } },
    },
  },
} satisfies Prisma.OrganizationPortalInclude;

export type PortalWithPages = Prisma.OrganizationPortalGetPayload<{
  include: typeof portalInclude;
}>;

export async function getPortalBuilderData(user: AppUser | null) {
  if (missingEnv(["DATABASE_URL"]).length > 0 || !user) {
    return { organization: null, portal: null, courses: [] };
  }

  const memberships = await prisma.organizationMembership.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { organization: true },
  });
  const membership = memberships.find((item) =>
    canManageOrganization(user, item),
  );
  if (!membership) return { organization: null, portal: null, courses: [] };

  const [portal, courses] = await Promise.all([
    ensurePortalForOrganization(membership.organizationId),
    prisma.course.findMany({
      where: portalPublishedCourseWhere(membership.organizationId),
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        subtitle: true,
        priceCents: true,
        currency: true,
        level: true,
        durationMinutes: true,
        instructor: { select: { name: true, imageUrl: true } },
        _count: { select: { sections: true } },
      },
    }),
  ]);

  return { organization: membership.organization, portal, courses };
}

export async function ensurePortalForOrganization(organizationId: string) {
  const existing = await prisma.organizationPortal.findUnique({
    where: { organizationId },
    include: portalInclude,
  });
  if (existing) {
    if (existing.pages.length === 0) {
      await prisma.portalPage.createMany({
        data: defaultPortalPages().map((page) => ({
          type: page.type,
          slug: page.slug,
          title: page.title,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
          portalId: existing.id,
        })),
      });
      const pages = await prisma.portalPage.findMany({
        where: { portalId: existing.id },
      });
      for (const page of pages) {
        const seed = defaultPortalPages().find(
          (item) => item.type === page.type,
        );
        const blocks = seed?.blocks.create ?? [];
        if (blocks.length > 0) {
          await prisma.portalBlock.createMany({
            data: blocks.map((block) => ({ ...block, pageId: page.id })),
          });
        }
      }
      return prisma.organizationPortal.findUniqueOrThrow({
        where: { id: existing.id },
        include: portalInclude,
      });
    }
    return existing;
  }

  return prisma.organizationPortal.create({
    data: {
      organizationId,
      navLinks: defaultNavLinks(),
      footerLinks: defaultFooterLinks(),
      pages: {
        create: defaultPortalPages(),
      },
    },
    include: portalInclude,
  });
}

export async function getPublishedPortal(organizationSlug: string) {
  if (missingEnv(["DATABASE_URL"]).length > 0) return null;

  return prisma.organization.findUnique({
    where: { slug: organizationSlug },
    include: {
      portal: {
        include: {
          pages: {
            where: { status: "PUBLISHED" },
            include: {
              blocks: {
                where: { publishedConfig: { not: Prisma.DbNull } },
                orderBy: { position: "asc" },
              },
            },
          },
        },
      },
    },
  });
}

export function getPortalPage<T extends { type: PortalPageType }>(
  portal: { pages: T[] } | null | undefined,
  type: PortalPageType,
) {
  return portal?.pages.find((page) => page.type === type) ?? null;
}

export async function getPortalCourses(organizationId: string, limit?: number) {
  return prisma.course.findMany({
    where: portalPublishedCourseWhere(organizationId),
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      subtitle: true,
      description: true,
      priceCents: true,
      currency: true,
      level: true,
      durationMinutes: true,
      instructor: { select: { name: true, imageUrl: true } },
      sections: {
        select: { lessons: { select: { id: true } } },
      },
      _count: { select: { sections: true } },
    },
  });
}

export function portalPublishedCourseWhere(organizationId: string) {
  return {
    status: "PUBLISHED" as const,
    OR: [
      { organizationId },
      {
        organizationId: null,
        instructor: {
          organizationMemberships: {
            some: { organizationId },
          },
        },
      },
    ],
  };
}

export function draftTheme(portal: {
  logoUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  buttonStyle: string;
  themeMode?: string | null;
  navLinks?: Prisma.JsonValue | null;
  footerLinks?: Prisma.JsonValue | null;
}): PortalTheme {
  return {
    logoUrl: portal.logoUrl,
    primaryColor: normalizeHex(portal.primaryColor, "#1e3a8a"),
    accentColor: normalizeHex(portal.accentColor, "#0f766e"),
    fontFamily: portal.fontFamily,
    buttonStyle: portal.buttonStyle,
    themeMode: normalizeThemeMode(portal.themeMode),
    navLinks: parseLinks(portal.navLinks, defaultNavLinks()),
    footerLinks: parseLinks(portal.footerLinks, defaultFooterLinks()),
  };
}

export function publishedTheme(portal: {
  publishedTheme?: Prisma.JsonValue | null;
  logoUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  buttonStyle: string;
  themeMode?: string | null;
  navLinks?: Prisma.JsonValue | null;
  footerLinks?: Prisma.JsonValue | null;
}): PortalTheme {
  if (isObject(portal.publishedTheme)) {
    return {
      logoUrl:
        typeof portal.publishedTheme.logoUrl === "string"
          ? portal.publishedTheme.logoUrl
          : null,
      primaryColor: normalizeHex(
        String(portal.publishedTheme.primaryColor ?? ""),
        "#1e3a8a",
      ),
      accentColor: normalizeHex(
        String(portal.publishedTheme.accentColor ?? ""),
        "#0f766e",
      ),
      fontFamily: String(portal.publishedTheme.fontFamily ?? "sans"),
      buttonStyle: String(portal.publishedTheme.buttonStyle ?? "rounded"),
      themeMode: normalizeThemeMode(
        String(portal.publishedTheme.themeMode ?? ""),
      ),
      navLinks: parseLinks(portal.publishedTheme.navLinks, defaultNavLinks()),
      footerLinks: parseLinks(
        portal.publishedTheme.footerLinks,
        defaultFooterLinks(),
      ),
    };
  }
  return draftTheme(portal);
}

function normalizeThemeMode(
  value: string | null | undefined,
): PortalTheme["themeMode"] {
  return value === "light" || value === "dark" ? value : "system";
}

export function blockConfig(block: {
  config?: Prisma.JsonValue;
  publishedConfig?: Prisma.JsonValue | null;
}) {
  return normalizeBlockConfig(block.config);
}

export function publicBlockConfig(block: {
  config?: Prisma.JsonValue;
  publishedConfig?: Prisma.JsonValue | null;
}) {
  return normalizeBlockConfig(block.publishedConfig ?? block.config);
}

export function linksToTextarea(links: PortalLink[]) {
  return links.map((link) => `${link.label}|${link.href}`).join("\n");
}

export function parseLinksInput(input: string, fallback: PortalLink[]) {
  const links = input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, href] = line.split("|").map((value) => value?.trim());
      return label && href ? { label, href } : null;
    })
    .filter((link): link is PortalLink => Boolean(link));
  return links.length > 0 ? links : fallback;
}

export function normalizeBlockConfig(
  value: Prisma.JsonValue | undefined | null,
) {
  if (!isObject(value)) return {};
  const items = Array.isArray(value.items)
    ? value.items.filter((item): item is string => typeof item === "string")
    : undefined;
  const courseLimit =
    typeof value.courseLimit === "number" && Number.isFinite(value.courseLimit)
      ? Math.max(1, Math.min(12, Math.round(value.courseLimit)))
      : undefined;

  return {
    eyebrow: stringValue(value.eyebrow),
    heading: stringValue(value.heading),
    body: stringValue(value.body),
    ctaLabel: stringValue(value.ctaLabel),
    ctaHref: stringValue(value.ctaHref),
    courseLimit,
    items,
  } satisfies PortalBlockConfig;
}

export function defaultBlockConfig(type: PortalBlockType): PortalBlockConfig {
  switch (type) {
    case "HERO":
      return {
        eyebrow: "Online learning",
        heading: "Build practical skills with our courses",
        body: "Explore guided lessons, track progress, and return to learning whenever you are ready.",
        ctaLabel: "Browse courses",
        ctaHref: "./courses",
      };
    case "FEATURED_COURSES":
      return {
        eyebrow: "Featured",
        heading: "Start with these courses",
        body: "Published courses from this organisation appear here.",
        courseLimit: 3,
      };
    case "COURSE_CATALOG":
      return {
        heading: "Course catalogue",
        body: "Find the course that fits your next step.",
        courseLimit: 6,
      };
    case "RICH_TEXT":
      return {
        heading: "About this school",
        body: "Share what learners can expect, who the training is for, and how your organisation supports their progress.",
      };
    case "INSTRUCTOR_PROFILE":
      return {
        heading: "Learn from experienced instructors",
        body: "Introduce the team behind the courses and the outcomes learners can expect.",
      };
    case "TESTIMONIALS":
      return {
        heading: "Learner outcomes",
        items: [
          "The course structure made it easy to keep going.",
          "I knew exactly what to do next after each lesson.",
        ],
      };
    case "FAQ":
      return {
        heading: "Frequently asked questions",
        items: [
          "How do I access a course? Sign in and open your learner dashboard.",
          "Can I get a certificate? Certificates appear when a course enables them and completion requirements are met.",
        ],
      };
    case "CTA":
      return {
        heading: "Ready to begin?",
        body: "Create an account or return to your learner dashboard.",
        ctaLabel: "Go to dashboard",
        ctaHref: "/dashboard",
      };
    case "LOGIN_SIGNUP":
      return {
        heading: "Join this learning portal",
        body: "Sign in to continue learning or create an account to enroll.",
        ctaLabel: "Sign in",
        ctaHref: "/sign-in",
      };
    default:
      return {
        heading: portalBlockLabels[type],
        body: "Configure this block from the portal builder.",
      };
  }
}

function defaultPortalPages() {
  return [
    {
      type: "HOME" as const,
      slug: "home",
      title: "Homepage",
      seoTitle: "Learning portal",
      seoDescription: "Explore courses and continue learning.",
      blocks: {
        create: [
          {
            type: "HERO" as const,
            position: 0,
            config: defaultBlockConfig("HERO"),
          },
          {
            type: "FEATURED_COURSES" as const,
            position: 1,
            config: defaultBlockConfig("FEATURED_COURSES"),
          },
          {
            type: "RICH_TEXT" as const,
            position: 2,
            config: defaultBlockConfig("RICH_TEXT"),
          },
          {
            type: "FAQ" as const,
            position: 3,
            config: defaultBlockConfig("FAQ"),
          },
          {
            type: "CTA" as const,
            position: 4,
            config: defaultBlockConfig("CTA"),
          },
        ],
      },
    },
    {
      type: "CATALOG" as const,
      slug: "courses",
      title: "Course catalogue",
      seoTitle: "Course catalogue",
      seoDescription: "Browse published courses.",
      blocks: { create: [] },
    },
    {
      type: "COURSE_TEMPLATE" as const,
      slug: "course",
      title: "Course page",
      seoTitle: "Course page",
      seoDescription: "View course details and enrollment options.",
      blocks: { create: [] },
    },
    {
      type: "AFTER_LOGIN" as const,
      slug: "learner-home",
      title: "Learner home",
      seoTitle: "Learner home",
      seoDescription: "Resume learning and review course progress.",
      blocks: {
        create: [
          {
            type: "RESUME_LEARNING" as const,
            position: 0,
            config: defaultBlockConfig("RESUME_LEARNING"),
          },
        ],
      },
    },
  ];
}

function parseLinks(
  value: Prisma.JsonValue | undefined | null,
  fallback: PortalLink[],
) {
  if (!Array.isArray(value)) return fallback;
  const links = value
    .map((item) => {
      if (!isObject(item)) return null;
      const label = stringValue(item.label);
      const href = stringValue(item.href);
      return label && href ? { label, href } : null;
    })
    .filter((link): link is PortalLink => Boolean(link));
  return links.length > 0 ? links : fallback;
}

function defaultNavLinks(): PortalLink[] {
  return [
    { label: "Home", href: "." },
    { label: "Courses", href: "./courses" },
  ];
}

function defaultFooterLinks(): PortalLink[] {
  return [{ label: "Dashboard", href: "/dashboard" }];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function isObject(value: unknown): value is Record<string, Prisma.JsonValue> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeHex(value: string, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}
