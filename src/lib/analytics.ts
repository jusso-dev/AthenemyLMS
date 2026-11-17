import { Prisma } from "@prisma/client";
import { cataloguePage, COURSE_PAGE_SIZE } from "@/lib/course-data";
import { prisma } from "@/lib/prisma";
import { missingEnv } from "@/lib/env";
import {
  authorableOrganizationIds,
  canAuthorCourses,
  managedOrganizationIds,
} from "@/lib/permissions";
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
  revenueByCurrency?: RevenueTotal[];
  completionRate: number;
  progressScore: number;
};

type EnrollmentRow = {
  courseId: string;
  status: string;
  count: number;
};

export type RevenueTotal = { currency: string; revenueCents: number };
type PaymentRow = {
  courseId: string;
  currency?: string;
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

export type LearnerRiskInput = {
  progressPercent: number;
  enrolledAt: Date;
  lastActivityAt?: Date | null;
  failedRequiredAssessments?: number;
  now?: Date;
};

export type ReportCsvRow = Record<string, string | number | null | undefined>;

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
  enrollments: EnrollmentRow[],
  payments: PaymentRow[],
  lessons: LessonRow[],
  progress: ProgressRow[],
) {
  const paymentsByCourse = new Map<string, RevenueTotal[]>();
  for (const row of payments) {
    const values = paymentsByCourse.get(row.courseId) ?? [];
    const currency = (row.currency ?? "usd").toLowerCase();
    const existing = values.find((value) => value.currency === currency);
    if (existing) existing.revenueCents += row.revenueCents;
    else values.push({ currency, revenueCents: row.revenueCents });
    paymentsByCourse.set(row.courseId, values);
  }
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
    const activeEnrollments = countEnrollments(
      enrollments,
      course.id,
      "ACTIVE",
    );
    const completedEnrollments = countEnrollments(
      enrollments,
      course.id,
      "COMPLETED",
    );
    const lessonCompletions = lessonCounts.get(course.id) ?? 0;
    const revenueByCurrency = paymentsByCourse.get(course.id) ?? [];
    // A scalar amount is meaningful only when there is one currency.
    const revenueCents =
      revenueByCurrency.length === 1 ? revenueByCurrency[0].revenueCents : 0;
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
      revenueByCurrency,
      completionRate,
      progressScore: completionRate,
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
  const revenue = courses.flatMap(
    (course) =>
      course.revenueByCurrency ?? [
        { currency: "usd", revenueCents: course.revenueCents },
      ],
  );

  return {
    dashboard: [
      { label: "Active enrollments", value: activeEnrollments.toString() },
      {
        label: "Published courses",
        value: courses
          .filter((course) => course.status === "PUBLISHED")
          .length.toString(),
      },
      { label: "Completion rate", value: completionRate },
      { label: "Lifetime revenue", value: formatRevenueTotals(revenue) },
    ],
    admin: [
      { label: "Users", value: userCount.toString() },
      { label: "Courses", value: courses.length.toString() },
      { label: "Enrollments", value: enrollmentTotal.toString() },
      { label: "Payments", value: formatRevenueTotals(revenue) },
    ],
  };
}

export function getLearnerRiskSignal(input: LearnerRiskInput) {
  const now = input.now ?? new Date();
  const lastActivityAt = input.lastActivityAt ?? input.enrolledAt;
  const inactiveDays = daysBetween(lastActivityAt, now);
  const enrollmentAgeDays = daysBetween(input.enrolledAt, now);
  const failedRequiredAssessments = input.failedRequiredAssessments ?? 0;

  if (failedRequiredAssessments > 0) {
    return {
      level: "high" as const,
      label: "Assessment risk",
      reason: "Failed a required assessment.",
    };
  }

  if (inactiveDays >= 14 && input.progressPercent < 100) {
    return {
      level: "high" as const,
      label: "Inactive",
      reason: `No activity for ${inactiveDays} days.`,
    };
  }

  if (enrollmentAgeDays >= 7 && input.progressPercent < 25) {
    return {
      level: "medium" as const,
      label: "Low progress",
      reason: "Progress is low for the enrollment age.",
    };
  }

  return {
    level: "low" as const,
    label: "On track",
    reason: "No risk signals detected.",
  };
}

export function toCsv(rows: ReportCsvRow[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) =>
      headers.map((header) => csvCell(row[header])).join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

export async function getInstructorAnalytics(
  user: AppUser | null,
  requestedPage?: string | number,
) {
  if (missingEnv(["DATABASE_URL"]).length > 0)
    return fallbackInstructorAnalytics();
  if (!user || !canAuthorCourses(user)) {
    return {
      mode: "permission" as AnalyticsMode,
      stats: [],
      courses: [],
      total: 0,
      page: 1,
      pageCount: 1,
    };
  }

  const courseWhere =
    user.role === "ADMIN"
      ? {}
      : {
          OR: [
            {
              instructorId: user.id,
              OR: [
                { organizationId: null },
                { organizationId: { in: authorableOrganizationIds(user) } },
              ],
            },
            { organizationId: { in: managedOrganizationIds(user) } },
          ],
        };
  const summary = await loadPlatformStats(courseWhere);
  const pageCount = Math.max(1, Math.ceil(summary.total / COURSE_PAGE_SIZE));
  const page = Math.min(cataloguePage(requestedPage), pageCount);
  const courses = await prisma.course.findMany({
    where: courseWhere,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: COURSE_PAGE_SIZE,
    skip: (page - 1) * COURSE_PAGE_SIZE,
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
    stats: summary.dashboard,
    courses: metrics,
    total: summary.total,
    page,
    pageCount,
  };
}

export async function getAdminAnalytics(user: AppUser | null) {
  if (missingEnv(["DATABASE_URL"]).length > 0) return fallbackAdminAnalytics();
  if (user?.role !== "ADMIN") {
    return { mode: "permission" as AnalyticsMode, stats: [], users: [] };
  }

  const [userCount, summary, users] = await Promise.all([
    prisma.user.count(),
    loadPlatformStats({}),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  return {
    mode: "database" as AnalyticsMode,
    stats: [
      { label: "Users", value: String(userCount) },
      { label: "Courses", value: String(summary.total) },
      { label: "Enrollments", value: String(summary.enrollmentTotal) },
      { label: "Payments", value: formatRevenueTotals(summary.revenue) },
    ],
    users,
  };
}

export function formatRevenueTotals(totals: RevenueTotal[]) {
  if (!totals.length) return formatPrice(0);
  const grouped = new Map<string, number>();
  for (const total of totals) {
    const currency = total.currency.toLowerCase();
    grouped.set(currency, (grouped.get(currency) ?? 0) + total.revenueCents);
  }
  return [...grouped]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([currency, cents]) =>
        `${formatPrice(cents, currency)}${grouped.size > 1 || currency !== "usd" ? ` ${currency.toUpperCase()}` : ""}`,
    )
    .join(" · ");
}
async function loadPlatformStats(courseWhere: Prisma.CourseWhereInput) {
  const [total, published, enrollments, payments] = await Promise.all([
    prisma.course.count({ where: courseWhere }),
    prisma.course.count({
      where: { AND: [courseWhere, { status: "PUBLISHED" }] },
    }),
    prisma.enrollment.groupBy({
      by: ["status"],
      where: { course: courseWhere },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ["currency"],
      where: { course: courseWhere, status: "PAID" },
      _sum: { amountCents: true, refundedAmountCents: true },
    }),
  ]);
  const active =
    enrollments.find((row) => row.status === "ACTIVE")?._count._all ?? 0;
  const completed =
    enrollments.find((row) => row.status === "COMPLETED")?._count._all ?? 0;
  const enrollmentTotal = active + completed;
  const revenue = payments.map((row) => ({
    currency: row.currency.toLowerCase(),
    revenueCents:
      (row._sum.amountCents ?? 0) - (row._sum.refundedAmountCents ?? 0),
  }));
  return {
    total,
    enrollmentTotal,
    revenue,
    dashboard: [
      { label: "Active enrollments", value: String(active) },
      { label: "Published courses", value: String(published) },
      {
        label: "Completion rate",
        value: `${enrollmentTotal ? Math.round((completed / enrollmentTotal) * 100) : 0}%`,
      },
      { label: "Lifetime revenue", value: formatRevenueTotals(revenue) },
    ],
  };
}
async function loadCourseMetrics(courses: CourseMetricInput[]) {
  const courseIds = courses.map((course) => course.id);
  if (!courseIds.length) return summarizeCourseMetrics(courses, [], [], [], []);
  const [enrollments, payments, completions] = await Promise.all([
    prisma.enrollment.groupBy({
      by: ["courseId", "status"],
      where: { courseId: { in: courseIds } },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ["courseId", "currency"],
      where: { courseId: { in: courseIds }, status: "PAID" },
      _sum: { amountCents: true, refundedAmountCents: true },
    }),
    prisma.$queryRaw<Array<{ courseId: string; count: bigint }>>(Prisma.sql`
      SELECT s."courseId", COUNT(p.id) AS count FROM "LessonProgress" p
      JOIN "Lesson" l ON l.id = p."lessonId" JOIN "CourseSection" s ON s.id = l."sectionId"
      WHERE p."completedAt" IS NOT NULL AND s."courseId" IN (${Prisma.join(courseIds)}) GROUP BY s."courseId"
    `),
  ]);
  const metrics = summarizeCourseMetrics(
    courses,
    enrollments.map((row) => ({
      courseId: row.courseId,
      status: row.status,
      count: row._count._all,
    })),
    payments.map((row) => ({
      courseId: row.courseId,
      currency: row.currency,
      revenueCents:
        (row._sum.amountCents ?? 0) - (row._sum.refundedAmountCents ?? 0),
    })),
    [],
    [],
  );
  const counts = new Map(
    completions.map((row) => [row.courseId, Number(row.count)]),
  );
  return metrics.map((metric) => ({
    ...metric,
    lessonCompletions: counts.get(metric.id) ?? 0,
  }));
}

function fallbackInstructorAnalytics() {
  return {
    mode: "fallback" as AnalyticsMode,
    stats: summarizePlatformStats([], 0).dashboard,
    courses: [],
    total: 0,
    page: 1,
    pageCount: 1,
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

function daysBetween(start: Date, end: Date) {
  return Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function csvCell(value: string | number | null | undefined) {
  const rawValue = value == null ? "" : String(value);
  // Treat spreadsheet formula prefixes as text, including after whitespace.
  const stringValue =
    typeof value === "string" && /^[\s]*[=+@-]/.test(rawValue)
      ? `'${rawValue}`
      : rawValue;
  if (!/[",\r\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replaceAll('"', '""')}"`;
}
