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

export const COURSE_PAGE_SIZE = 24;
export function cataloguePage(value?: string | number) {
  const parsed = Number(value ?? 1);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}
export async function getCourseCatalogue(
  where: Prisma.CourseWhereInput,
  query?: string,
  requestedPage?: string | number,
) {
  const search =
    typeof query === "string" ? query.trim().slice(0, 200) : undefined;
  const filter: Prisma.CourseWhereInput = {
    AND: [
      where,
      search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { subtitle: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };
  if (missingEnv(["DATABASE_URL"]).length > 0)
    return { courses: [], total: 0, page: 1, pageCount: 1 };
  const total = await prisma.course.count({ where: filter });
  const pageCount = Math.max(1, Math.ceil(total / COURSE_PAGE_SIZE));
  const page = Math.min(cataloguePage(requestedPage), pageCount);
  const courses = await prisma.course.findMany({
    where: filter,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: courseCardSelect,
    take: COURSE_PAGE_SIZE,
    skip: (page - 1) * COURSE_PAGE_SIZE,
  });
  return { courses, total, page, pageCount };
}
export async function getPublishedCourseCatalogue(
  query?: string,
  page?: string | number,
) {
  return getCourseCatalogue({ status: "PUBLISHED" }, query, page);
}
export async function getPublishedCourses(query?: string) {
  return (await getPublishedCourseCatalogue(query)).courses;
}

export async function getCourseBySlug(slug: string) {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    return null;
  }

  return await prisma.course.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: courseDetailInclude,
  });
}
