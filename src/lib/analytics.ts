import { prisma } from "@/lib/prisma";
import { missingEnv } from "@/lib/env";
import { hasRole } from "@/lib/permissions";
import { formatPrice } from "@/lib/utils";
import type { AppUser } from "@/lib/auth";

type AnalyticsMode = "database" | "fallback" | "permission";

export type CourseMetricInput = {
  id: string;
  title: string;
  level: string;
  status: string;
  instructor?: { name: string | null } | null;
};

export type CourseMetric = CourseMetricInput & {
  activeEnrollments: number;
  completedEnrollments: number;
  lessonCompletions: number;
  revenueCents: number;
  completionRate: number;
  progressScore: number;
};

type RollupRow = {
  courseId: string | null;
  activeEnrollments: number;
  completedEnrollments: number;
  lessonCompletions: number;
  revenueCents: number;
};

type EnrollmentRow = {
  courseId: string;
  status: string;
  count: number;
};

type PaymentRow = {
  courseId: string;
  revenueCents: number;
};

type LessonRow = {
  id: string;
  courseId: string;
};

type ProgressRow = {
  lessonId: string;
  count: number;
};

export function analyticsFallbackNotice() {
  return {
    title: "Supabase setup required",
    items: [
      "Add DATABASE_URL to .env.local and run migrations to read persisted analytics.",
    ],
  };
}

export function summarizeCourseMetrics(
  courses: CourseMetricInput[],
  rollups: RollupRow[],
  enrollments: EnrollmentRow[],
  payments: PaymentRow[],
  lessons: LessonRow[],
  progress: ProgressRow[],
) {
  const rollupsByCourse = new Map(
    rollups
      .filter((row) => row.courseId)
      .map((row) => [row.courseId as string, row]),
  );
  const paymentsByCourse = new Map(
    payments.map((row) => [row.courseId, row.revenueCents]),
  );
  const lessonCourse = new Map(
    lessons.map((lesson) => [lesson.id, lesson.courseId]),
  );
  const lessonCounts = new Map<string, number>();
  for (const row of progress) {
    const courseId = lessonCourse.get(row.lessonId);
    if (!courseId) continue;
    lessonCounts.set(courseId, (lessonCounts.get(courseId) ?? 0) + row.count);
  }

  return courses.map((course) => {
    const rollup = rollupsByCourse.get(course.id);
    const activeEnrollments =
      rollup?.activeEnrollments ??
      countEnrollments(enrollments, course.id, "ACTIVE");
    const completedEnrollments =
      rollup?.completedEnrollments ??
      countEnrollments(enrollments, course.id, "COMPLETED");
    const lessonCompletions =
      rollup?.lessonCompletions ?? lessonCounts.get(course.id) ?? 0;
    const revenueCents =
      rollup?.revenueCents ?? paymentsByCourse.get(course.id) ?? 0;
    const totalEnrollments = activeEnrollments + completedEnrollments;
    const completionRate =
      totalEnrollments > 0
        ? Math.round((completedEnrollments / totalEnrollments) * 100)
        : 0;

    return {
      ...course,
      activeEnrollments,
      completedEnrollments,
      lessonCompletions,
      revenueCents,
      completionRate,
      progressScore: Math.min(100, completionRate || lessonCompletions * 5),
    };
  });
}

export function summarizePlatformStats(
  courses: CourseMetric[],
  userCount: number,
) {
  const activeEnrollments = courses.reduce(
    (total, course) => total + course.activeEnrollments,
    0,
  );
  const completedEnrollments = courses.reduce(
    (total, course) => total + course.completedEnrollments,
    0,
  );
  const enrollmentTotal = activeEnrollments + completedEnrollments;
  const completionRate =
    enrollmentTotal > 0
      ? `${Math.round((completedEnrollments / enrollmentTotal) * 100)}%`
      : "0%";
  const revenueCents = courses.reduce(
    (total, course) => total + course.revenueCents,
    0,
  );

  return {
    dashboard: [
      { label: "Active enrollments", value: activeEnrollments.toString() },
      { label: "Published courses", value: courses.length.toString() },
      { label: "Completion rate", value: completionRate },
      { label: "Revenue this month", value: formatPrice(revenueCents) },
    ],
    admin: [
      { label: "Users", value: userCount.toString() },
      { label: "Courses", value: courses.length.toString() },
      { label: "Enrollments", value: enrollmentTotal.toString() },
      { label: "Payments", value: formatPrice(revenueCents) },
    ],
  };
}

export async function getInstructorAnalytics(user: AppUser | null) {
  if (missingEnv(["DATABASE_URL"]).length > 0)
    return fallbackInstructorAnalytics();
  if (!hasRole(user?.role, "INSTRUCTOR")) {
    return { mode: "permission" as AnalyticsMode, stats: [], courses: [] };
  }

  try {
    const courseWhere =
      user?.role === "ADMIN"
        ? { status: "PUBLISHED" as const }
        : { instructorId: user?.id };
    const courses = await prisma.course.findMany({
      where: courseWhere,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        level: true,
        status: true,
        instructor: { select: { name: true } },
      },
    });
    const metrics = await loadCourseMetrics(courses);
    return {
      mode: "database" as AnalyticsMode,
      stats: summarizePlatformStats(metrics, 0).dashboard,
      courses: metrics,
    };
  } catch {
    return fallbackInstructorAnalytics();
  }
}

export async function getAdminAnalytics(user: AppUser | null) {
  if (missingEnv(["DATABASE_URL"]).length > 0) return fallbackAdminAnalytics();
  if (user?.role !== "ADMIN") {
    return { mode: "permission" as AnalyticsMode, stats: [], users: [] };
  }

  try {
    const [userCount, courses, users] = await Promise.all([
      prisma.user.count(),
      prisma.course.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          level: true,
          status: true,
          instructor: { select: { name: true } },
        },
      }),
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    ]);
    const metrics = await loadCourseMetrics(courses);
    return {
      mode: "database" as AnalyticsMode,
      stats: summarizePlatformStats(metrics, userCount).admin,
      users,
    };
  } catch {
    return fallbackAdminAnalytics();
  }
}

async function loadCourseMetrics(courses: CourseMetricInput[]) {
  const courseIds = courses.map((course) => course.id);
  if (courseIds.length === 0) {
    return summarizeCourseMetrics(courses, [], [], [], [], []);
  }

  const [rollups, enrollmentGroups, paymentGroups, lessons, progressGroups] =
    await Promise.all([
      prisma.analyticsRollup.groupBy({
        by: ["courseId"],
        where: { scope: "COURSE", courseId: { in: courseIds } },
        _sum: {
          activeEnrollments: true,
          completedEnrollments: true,
          lessonCompletions: true,
          revenueCents: true,
        },
      }),
      prisma.enrollment.groupBy({
        by: ["courseId", "status"],
        where: { courseId: { in: courseIds } },
        _count: { _all: true },
      }),
      prisma.payment.groupBy({
        by: ["courseId"],
        where: { courseId: { in: courseIds }, status: "PAID" },
        _sum: { amountCents: true },
      }),
      prisma.lesson.findMany({
        where: { section: { courseId: { in: courseIds } } },
        select: { id: true, section: { select: { courseId: true } } },
      }),
      prisma.lessonProgress.groupBy({
        by: ["lessonId"],
        where: {
          completedAt: { not: null },
          lesson: { section: { courseId: { in: courseIds } } },
        },
        _count: { _all: true },
      }),
    ]);

  return summarizeCourseMetrics(
    courses,
    rollups.map((row) => ({
      courseId: row.courseId,
      activeEnrollments: row._sum.activeEnrollments ?? 0,
      completedEnrollments: row._sum.completedEnrollments ?? 0,
      lessonCompletions: row._sum.lessonCompletions ?? 0,
      revenueCents: row._sum.revenueCents ?? 0,
    })),
    enrollmentGroups.map((row) => ({
      courseId: row.courseId,
      status: row.status,
      count: row._count._all,
    })),
    paymentGroups.map((row) => ({
      courseId: row.courseId,
      revenueCents: row._sum.amountCents ?? 0,
    })),
    lessons.map((lesson) => ({
      id: lesson.id,
      courseId: lesson.section.courseId,
    })),
    progressGroups.map((row) => ({
      lessonId: row.lessonId,
      count: row._count._all,
    })),
  );
}

function fallbackInstructorAnalytics() {
  return {
    mode: "fallback" as AnalyticsMode,
    stats: summarizePlatformStats([], 0).dashboard,
    courses: [],
  };
}

function fallbackAdminAnalytics() {
  return {
    mode: "fallback" as AnalyticsMode,
    stats: summarizePlatformStats([], 0).admin,
    users: [],
  };
}

function countEnrollments(
  enrollments: EnrollmentRow[],
  courseId: string,
  status: string,
) {
  return (
    enrollments.find(
      (row) => row.courseId === courseId && row.status === status,
    )?.count ?? 0
  );
}
