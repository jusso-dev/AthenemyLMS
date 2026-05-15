import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export const courseExportSchema = z.object({
  format: z.literal("athenemy.course.v1"),
  exportedAt: z.string(),
  course: z.object({
    title: z.string().min(3).max(120),
    slug: z.string().min(3).max(140),
    subtitle: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    thumbnailUrl: z.string().optional().nullable(),
    priceCents: z.number().int().min(0),
    currency: z.string().default("usd"),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
    level: z.string().default("Beginner"),
    durationMinutes: z.number().int().min(0).default(0),
    sections: z.array(
      z.object({
        title: z.string().min(1),
        position: z.number().int().min(0),
        lessons: z.array(
          z.object({
            title: z.string().min(1),
            slug: z.string().min(1),
            content: z.string().optional().nullable(),
            videoUrl: z.string().optional().nullable(),
            durationMinutes: z.number().int().min(0),
            preview: z.boolean(),
            position: z.number().int().min(0),
            resources: z.array(
              z.object({
                title: z.string().min(1),
                fileUrl: z.string().url(),
                fileKey: z.string().optional().nullable(),
                fileType: z.string().optional().nullable(),
                fileSize: z.number().int().optional().nullable(),
              }),
            ),
          }),
        ),
      }),
    ),
  }),
});

export type CourseExport = z.infer<typeof courseExportSchema>;

export async function buildCourseExport(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            include: { resources: true },
          },
        },
      },
    },
  });

  if (!course) throw new Error("Course not found.");

  return {
    format: "athenemy.course.v1" as const,
    exportedAt: new Date().toISOString(),
    course: {
      title: course.title,
      slug: course.slug,
      subtitle: course.subtitle,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      priceCents: course.priceCents,
      currency: course.currency,
      status: course.status,
      level: course.level,
      durationMinutes: course.durationMinutes,
      sections: course.sections.map((section) => ({
        title: section.title,
        position: section.position,
        lessons: section.lessons.map((lesson) => ({
          title: lesson.title,
          slug: lesson.slug,
          content: lesson.content,
          videoUrl: lesson.videoUrl,
          durationMinutes: lesson.durationMinutes,
          preview: lesson.preview,
          position: lesson.position,
          resources: lesson.resources.map((resource) => ({
            title: resource.title,
            fileUrl: resource.fileUrl,
            fileKey: resource.fileKey,
            fileType: resource.fileType,
            fileSize: resource.fileSize,
          })),
        })),
      })),
    },
  } satisfies CourseExport;
}

export async function importCourse(input: unknown, instructorId: string) {
  const parsed = courseExportSchema.parse(input);
  const slug = await uniqueCourseSlug(parsed.course.slug || slugify(parsed.course.title));

  return prisma.course.create({
    data: {
      title: parsed.course.title,
      slug,
      subtitle: parsed.course.subtitle,
      description: parsed.course.description,
      thumbnailUrl: parsed.course.thumbnailUrl,
      priceCents: parsed.course.priceCents,
      currency: parsed.course.currency,
      status: "DRAFT",
      level: parsed.course.level,
      durationMinutes: parsed.course.durationMinutes,
      instructorId,
      sections: {
        create: parsed.course.sections.map((section) => ({
          title: section.title,
          position: section.position,
          lessons: {
            create: section.lessons.map((lesson) => ({
              title: lesson.title,
              slug: lesson.slug,
              content: lesson.content,
              videoUrl: lesson.videoUrl,
              durationMinutes: lesson.durationMinutes,
              preview: lesson.preview,
              position: lesson.position,
              resources: {
                create: lesson.resources.map((resource) => ({
                  title: resource.title,
                  fileUrl: resource.fileUrl,
                  fileKey: resource.fileKey,
                  fileType: resource.fileType,
                  fileSize: resource.fileSize,
                })),
              },
            })),
          },
        })),
      },
    },
  });
}

async function uniqueCourseSlug(baseSlug: string) {
  const normalized = slugify(baseSlug);
  const existing = await prisma.course.findUnique({ where: { slug: normalized } });
  if (!existing) return normalized;
  return `${normalized}-import-${Date.now()}`;
}
