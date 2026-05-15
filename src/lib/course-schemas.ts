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

export const assessmentSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(1000).optional().or(z.literal("")),
  prompt: z.string().min(5).max(1000),
  options: z.string().min(3).max(4000),
  correctIndex: z.coerce.number().int().min(0).max(9),
  passingScore: z.coerce.number().int().min(1).max(100).default(70),
  requiredForCompletion: z.coerce.boolean().default(false),
});

export function courseDefaults(title = "") {
  return {
    title,
    slug: title ? slugify(title) : "",
    subtitle: "",
    description: "",
    priceCents: 0,
    status: "DRAFT" as const,
    thumbnailUrl: "",
  };
}
