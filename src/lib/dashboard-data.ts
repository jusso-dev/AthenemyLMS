import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { missingEnv } from "@/lib/env";
import { dashboardStats, mockCourses } from "@/lib/mock-data";
import type { AppUser } from "@/lib/auth";
import { canManageCourse, hasRole } from "@/lib/permissions";
import { formatPrice } from "@/lib/utils";

type DashboardMode = "database" | "fallback" | "permission";

const courseInclude = {
  instructor: { select: { name: true, imageUrl: true } },
  sections: {
    orderBy: { position: "asc" as const },
    include: {
      lessons: {
        orderBy: { position: "asc" as const },
        include: { resources: true },
      },
    },
  },
  _count: { select: { enrollments: true, payments: true } },
} satisfies Prisma.CourseInclude;

export type DashboardCourse = Prisma.CourseGetPayload<{
  include: typeof courseInclude;
}>;

export function databaseIsConfigured() {
  return missingEnv(["DATABASE_URL"]).length === 0;
}

export function fallbackNotice() {
  return {
    title: "Local setup mode",
    items: [
      "Supabase is not configured or could not be reached, so this dashboard is showing explicit mock data.",
      "Add DATABASE_URL and DIRECT_URL to .env.local, run migrations, and sign in with Clerk to use persisted data.",
    ],
  };
}

export async function getDashboardOverview(user: AppUser | null) {
  if (!databaseIsConfigured()) return fallbackOverview();

  try {
    const courseScope = scopeCoursesToUser(user);
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const [activeEnrollments, publishedCourses, completedEnrollments, revenue, courses] =
      await Promise.all([
        prisma.enrollment.count({
          where: { status: "ACTIVE", course: courseScope },
        }),
        prisma.course.count({
          where: { status: "PUBLISHED", ...courseScope },
        }),
        prisma.enrollment.count({
          where: { status: "COMPLETED", course: courseScope },
        }),
        prisma.payment.aggregate({
          _sum: { amountCents: true },
          where: {
            status: "PAID",
            createdAt: { gte: startOfMonth },
            course: courseScope,
          },
        }),
        prisma.course.findMany({
          where: courseScope,
          orderBy: { updatedAt: "desc" },
          take: 5,
          include: courseInclude,
        }),
      ]);

    const enrollmentTotal = activeEnrollments + completedEnrollments;
    const completionRate =
      enrollmentTotal > 0
        ? `${Math.round((completedEnrollments / enrollmentTotal) * 100)}%`
        : "0%";

    return {
      mode: "database" as DashboardMode,
      stats: [
        { label: "Active enrollments", value: activeEnrollments.toString() },
        { label: "Published courses", value: publishedCourses.toString() },
        { label: "Completion rate", value: completionRate },
        {
          label: "Revenue this month",
          value: formatPrice(revenue._sum.amountCents ?? 0),
        },
      ],
      courses: courses.map((course) => ({
        id: course.id,
        title: course.title,
        instructor: course.instructor,
        level: course.level,
        status: course.status,
        progress: course._count.enrollments > 0 ? 72 : 0,
      })),
    };
  } catch {
    return fallbackOverview();
  }
}

export async function getManageCourses(
  user: AppUser | null,
  query?: string,
) {
  if (!databaseIsConfigured()) {
    return { mode: "fallback" as DashboardMode, courses: filterMockCourses(query) };
  }

  if (!hasRole(user?.role, "INSTRUCTOR")) {
    return { mode: "permission" as DashboardMode, courses: [] };
  }

  try {
    return {
      mode: "database" as DashboardMode,
      courses: await prisma.course.findMany({
        where: {
          ...scopeCoursesToUser(user),
          OR: query
            ? [
                { title: { contains: query, mode: "insensitive" } },
                { subtitle: { contains: query, mode: "insensitive" } },
              ]
            : undefined,
        },
        orderBy: { updatedAt: "desc" },
        include: courseInclude,
      }),
    };
  } catch {
    return { mode: "fallback" as DashboardMode, courses: filterMockCourses(query) };
  }
}

export async function getEditableCourse(user: AppUser | null, courseId: string) {
  if (!databaseIsConfigured()) {
    const course = mockCourses.find((item) => item.id === courseId) ?? null;
    return { mode: "fallback" as DashboardMode, course };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: courseInclude,
  });

  if (!canManageCourse(user, course)) {
    return { mode: "permission" as DashboardMode, course: null };
  }

  return { mode: "database" as DashboardMode, course };
}

export async function getMyCourses(user: AppUser | null) {
  if (!databaseIsConfigured()) {
    return { mode: "fallback" as DashboardMode, courses: mockCourses.slice(0, 2) };
  }

  if (!user) return { mode: "permission" as DashboardMode, courses: [] };

  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: user.id, status: { in: ["ACTIVE", "COMPLETED"] } },
      orderBy: { updatedAt: "desc" },
      include: { course: { include: courseInclude } },
    });

    return {
      mode: "database" as DashboardMode,
      courses: enrollments.map((enrollment) => enrollment.course),
    };
  } catch {
    return { mode: "fallback" as DashboardMode, courses: mockCourses.slice(0, 2) };
  }
}

export async function getLearnCourse(user: AppUser | null, courseId: string) {
  if (!databaseIsConfigured()) {
    const course = mockCourses.find((item) => item.id === courseId) ?? null;
    return { mode: "fallback" as DashboardMode, course, completedLessonIds: [] as string[] };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: courseInclude,
  });

  if (!course) {
    return {
      mode: "database" as DashboardMode,
      course: null,
      completedLessonIds: [] as string[],
    };
  }

  const canManage = canManageCourse(user, course);
  const enrollment = user
    ? await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId } },
      })
    : null;

  if (!canManage && !enrollment) {
    return {
      mode: "permission" as DashboardMode,
      course: null,
      completedLessonIds: [] as string[],
    };
  }

  const progress = user
    ? await prisma.lessonProgress.findMany({
        where: {
          userId: user.id,
          completedAt: { not: null },
          lesson: { section: { courseId } },
        },
        select: { lessonId: true },
      })
    : [];

  return {
    mode: "database" as DashboardMode,
    course,
    completedLessonIds: progress.map((item) => item.lessonId),
  };
}

export async function getCourseStudents(user: AppUser | null, courseId: string) {
  if (!databaseIsConfigured()) {
    return {
      mode: "fallback" as DashboardMode,
      students: [
        { name: "Amelia Chen", email: "amelia@example.com", progress: 86, status: "Active" },
        { name: "Jon Bell", email: "jon@example.com", progress: 48, status: "Active" },
        { name: "Priya Shah", email: "priya@example.com", progress: 100, status: "Completed" },
      ],
    };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      sections: { include: { lessons: { select: { id: true } } } },
      enrollments: { include: { user: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!course || !canManageCourse(user, course)) {
    return { mode: "permission" as DashboardMode, students: [] };
  }

  const lessonIds = course.sections.flatMap((section) =>
    section.lessons.map((lesson) => lesson.id),
  );
  const progress = lessonIds.length
    ? await prisma.lessonProgress.findMany({
        where: {
          lessonId: { in: lessonIds },
          completedAt: { not: null },
          userId: { in: course.enrollments.map((enrollment) => enrollment.userId) },
        },
        select: { userId: true },
      })
    : [];

  return {
    mode: "database" as DashboardMode,
    students: course.enrollments.map((enrollment) => {
      const completed = progress.filter(
        (item) => item.userId === enrollment.userId,
      ).length;
      return {
        name: enrollment.user.name ?? "Unnamed learner",
        email: enrollment.user.email,
        progress: lessonIds.length
          ? Math.round((completed / lessonIds.length) * 100)
          : 0,
        status: enrollment.status === "COMPLETED" ? "Completed" : "Active",
      };
    }),
  };
}

export async function getAdminOverview(user: AppUser | null) {
  if (!databaseIsConfigured()) {
    return {
      mode: "fallback" as DashboardMode,
      stats: [
        { label: "Users", value: "312" },
        { label: "Courses", value: "18" },
        { label: "Enrollments", value: "1,024" },
        { label: "Payments", value: "$42k" },
      ],
      users: [
        { name: "Admin Owner", email: "admin.owner@example.com", role: "ADMIN" },
        { name: "Instructor Demo", email: "instructor.demo@example.com", role: "INSTRUCTOR" },
        { name: "Student Demo", email: "student.demo@example.com", role: "STUDENT" },
      ],
    };
  }

  if (user?.role !== "ADMIN") {
    return { mode: "permission" as DashboardMode, stats: [], users: [] };
  }

  const [users, courses, enrollments, payments, recentUsers] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.enrollment.count(),
    prisma.payment.aggregate({ _sum: { amountCents: true }, where: { status: "PAID" } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return {
    mode: "database" as DashboardMode,
    stats: [
      { label: "Users", value: users.toString() },
      { label: "Courses", value: courses.toString() },
      { label: "Enrollments", value: enrollments.toString() },
      { label: "Payments", value: formatPrice(payments._sum.amountCents ?? 0) },
    ],
    users: recentUsers,
  };
}

function fallbackOverview() {
  return {
    mode: "fallback" as DashboardMode,
    stats: dashboardStats,
    courses: mockCourses.map((course) => ({
      id: course.id,
      title: course.title,
      instructor: course.instructor,
      level: course.level,
      status: course.status,
      progress: course.priceCents === 0 ? 81 : 64,
    })),
  };
}

function scopeCoursesToUser(user: AppUser | null) {
  if (!user || user.role === "ADMIN") return {};
  if (user.role === "INSTRUCTOR") return { instructorId: user.id };
  return { enrollments: { some: { userId: user.id } } };
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
