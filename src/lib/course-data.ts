import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { missingEnv } from "@/lib/env";

const courseCardSelect = {
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
} satisfies Prisma.CourseSelect;

const courseDetailInclude = {
  instructor: { select: { name: true, imageUrl: true } },
  sections: {
    orderBy: { position: "asc" as const },
    include: {
      lessons: {
        orderBy: { position: "asc" as const },
        select: { id: true, title: true, position: true },
      },
    },
  },
} satisfies Prisma.CourseInclude;

export type PublicCourse = Prisma.CourseGetPayload<{
  include: typeof courseDetailInclude;
}>;

export async function getPublishedCourses(query?: string) {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    return [];
  }

  try {
    return await prisma.course.findMany({
      where: {
        status: "PUBLISHED",
        OR: query
          ? [
              { title: { contains: query, mode: "insensitive" } },
              { subtitle: { contains: query, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: { updatedAt: "desc" },
      select: courseCardSelect,
    });
  } catch {
    return [];
  }
}

export async function getCourseBySlug(slug: string) {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    return null;
  }

  try {
    return await prisma.course.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: courseDetailInclude,
    });
  } catch {
    return null;
  }
}
