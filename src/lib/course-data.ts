import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { missingEnv } from "@/lib/env";
import { mockCourses } from "@/lib/mock-data";

export type PublicCourse = (typeof mockCourses)[number];

const include = {
  instructor: { select: { name: true, imageUrl: true } },
  sections: {
    orderBy: { position: "asc" as const },
    include: { lessons: { orderBy: { position: "asc" as const } } },
  },
} satisfies Prisma.CourseInclude;

export async function getPublishedCourses(query?: string) {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    return filterMockCourses(query);
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
      include,
    });
  } catch {
    return filterMockCourses(query);
  }
}

export async function getCourseBySlug(slug: string) {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    return mockCourses.find((course) => course.slug === slug) ?? null;
  }

  try {
    return await prisma.course.findUnique({ where: { slug }, include });
  } catch {
    return mockCourses.find((course) => course.slug === slug) ?? null;
  }
}

function filterMockCourses(query?: string) {
  if (!query) return mockCourses;
  const normalized = query.toLowerCase();
  return mockCourses.filter((course) =>
    [course.title, course.subtitle, course.description].some((value) =>
      value.toLowerCase().includes(normalized),
    ),
  );
}
