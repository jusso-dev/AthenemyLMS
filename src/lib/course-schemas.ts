import { z } from "zod";
import { slugify } from "@/lib/utils";

export const courseSchema = z.object({
  title: z.string().min(3, "Use at least 3 characters").max(120),
  slug: z
    .string()
    .min(3)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-safe slug"),
  subtitle: z.string().max(180).optional().or(z.literal("")),
  description: z.string().max(6000).optional().or(z.literal("")),
  priceCents: z.coerce.number().int().min(0).max(200000),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  certificatesEnabled: z.coerce.boolean().default(true),
  thumbnailUrl: z.string().url().optional().or(z.literal("")),
});

export const lessonSchema = z.object({
  title: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  content: z.string().optional(),
  videoUrl: z.string().url().optional().or(z.literal("")),
  durationMinutes: z.coerce.number().int().min(0).max(1000),
  preview: z.coerce.boolean().default(false),
});

export const lessonContentSchema = lessonSchema.extend({
  content: z
    .string()
    .max(20000, "Lesson content must stay under 20,000 characters")
    .optional()
    .or(z.literal("")),
});

export const lessonVideoSchema = z.object({
  videoUrl: z
    .string()
    .url("Use a valid video URL")
    .optional()
    .or(z.literal("")),
  videoProvider: z.enum(["EXTERNAL", "R2"]).default("EXTERNAL"),
  videoAssetKey: z.string().max(500).optional().or(z.literal("")),
  videoMimeType: z.string().max(120).optional().or(z.literal("")),
  videoBytes: z.coerce.number().int().positive().optional().or(z.literal("")),
});

export const assessmentSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(1000).optional().or(z.literal("")),
  prompt: z.string().min(5).max(1000),
  options: z.string().min(3).max(4000),
  correctIndex: z.coerce.number().int().min(0).max(9),
  passingScore: z.coerce.number().int().min(1).max(100).default(70),
  requiredForCompletion: z.coerce.boolean().default(false),
});

export const assessmentSettingsSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(1000).optional().or(z.literal("")),
  passingScore: z.coerce.number().int().min(1).max(100).default(70),
  requiredForCompletion: z.coerce.boolean().default(false),
});

export const organizationSchema = z.object({
  name: z.string().min(2).max(120),
  supportEmail: z.string().email().optional().or(z.literal("")),
});

export const invitationSchema = z.object({
  organizationId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["ADMIN", "INSTRUCTOR", "MEMBER"]).default("MEMBER"),
});

export const organizationMemberSchema = z.object({
  organizationId: z.string().min(1),
  membershipId: z.string().min(1),
  name: z.string().max(120).optional().or(z.literal("")),
  appRole: z.enum(["STUDENT", "INSTRUCTOR", "ADMIN"]),
  orgRole: z.enum(["OWNER", "ADMIN", "INSTRUCTOR", "MEMBER"]),
});

export const organizationMemberIdSchema = z.object({
  organizationId: z.string().min(1),
  membershipId: z.string().min(1),
});

export const sectionSchema = z.object({
  title: z.string().min(2).max(120),
});

export const profileSchema = z.object({
  name: z.string().max(120).optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
});

export function courseDefaults(title = "") {
  return {
    title,
    slug: title ? slugify(title) : "",
    subtitle: "",
    description: "",
    priceCents: 0,
    status: "DRAFT" as const,
    certificatesEnabled: true,
    thumbnailUrl: "",
  };
}
