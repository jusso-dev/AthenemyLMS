import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { missingEnv } from "@/lib/env";
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
    title: "Supabase setup required",
    items: [
      "Add DATABASE_URL and DIRECT_URL to .env.local, then run migrations to use persisted data.",
    ],
  };
}

export async function getDashboardOverview(user: AppUser | null) {
  if (!databaseIsConfigured()) return emptyOverview();

  try {
    const courseScope = scopeCoursesToUser(user);
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const [
      activeEnrollments,
      publishedCourses,
      completedEnrollments,
      revenue,
      courses,
    ] = await Promise.all([
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
    return emptyOverview();
  }
}

export async function getManageCourses(user: AppUser | null, query?: string) {
  if (!databaseIsConfigured()) {
    return { mode: "fallback" as DashboardMode, courses: [] };
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
    return { mode: "fallback" as DashboardMode, courses: [] };
  }
}

export async function getEditableCourse(
  user: AppUser | null,
  courseId: string,
) {
  if (!databaseIsConfigured()) {
    return { mode: "fallback" as DashboardMode, course: null };
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
    return {
      mode: "fallback" as DashboardMode,
      courses: [],
      summary: emptyLearnerSummary(),
    };
  }

  if (!user) {
    return {
      mode: "permission" as DashboardMode,
      courses: [],
      summary: emptyLearnerSummary(),
    };
  }

  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: user.id, status: { in: ["ACTIVE", "COMPLETED"] } },
      orderBy: { updatedAt: "desc" },
      include: { course: { include: courseInclude } },
    });
    const courseIds = enrollments.map((enrollment) => enrollment.courseId);
    const lessonIds = enrollments.flatMap((enrollment) =>
      enrollment.course.sections.flatMap((section) =>
        section.lessons.map((lesson) => lesson.id),
      ),
    );
    const [progress, requiredAssessments, submissions, certificates] =
      courseIds.length
        ? await Promise.all([
            lessonIds.length
              ? prisma.lessonProgress.findMany({
                  where: {
                    userId: user.id,
                    lessonId: { in: lessonIds },
                    completedAt: { not: null },
                  },
                  select: { lessonId: true },
                })
              : [],
            prisma.assessment.findMany({
              where: { courseId: { in: courseIds }, requiredForCompletion: true },
              select: { id: true, courseId: true, title: true },
            }),
            prisma.assessmentSubmission.findMany({
              where: {
                userId: user.id,
                passed: true,
                assessment: { courseId: { in: courseIds } },
              },
              select: { assessmentId: true },
            }),
            prisma.certificate.findMany({
              where: { userId: user.id, courseId: { in: courseIds } },
              select: { courseId: true, certificateNumber: true },
            }),
          ])
        : [[], [], [], []];

    const completedLessonIds = new Set(progress.map((item) => item.lessonId));
    const passedAssessmentIds = new Set(
      submissions.map((submission) => submission.assessmentId),
    );
    const certificateByCourseId = new Map(
      certificates.map((certificate) => [
        certificate.courseId,
        certificate.certificateNumber,
      ]),
    );
    const requiredAssessmentsByCourseId = new Map<
      string,
      typeof requiredAssessments
    >();
    for (const assessment of requiredAssessments) {
      const courseAssessments =
        requiredAssessmentsByCourseId.get(assessment.courseId) ?? [];
      courseAssessments.push(assessment);
      requiredAssessmentsByCourseId.set(assessment.courseId, courseAssessments);
    }

    const courses = enrollments.map((enrollment) => {
      const lessons = enrollment.course.sections.flatMap(
        (section) => section.lessons,
      );
      const completedLessons = lessons.filter((lesson) =>
        completedLessonIds.has(lesson.id),
      );
      const required = requiredAssessmentsByCourseId.get(enrollment.courseId) ?? [];
      const completedRequired = required.filter((assessment) =>
        passedAssessmentIds.has(assessment.id),
      );
      const nextLesson =
        lessons.find((lesson) => !completedLessonIds.has(lesson.id)) ??
        lessons[0] ??
        null;

      return {
        enrollmentStatus: enrollment.status,
        enrolledAt: enrollment.createdAt,
        course: enrollment.course,
        progressPercent: lessons.length
          ? Math.round((completedLessons.length / lessons.length) * 100)
          : 0,
        completedLessons: completedLessons.length,
        totalLessons: lessons.length,
        nextLesson,
        requiredAssessments: required.length,
        completedRequiredAssessments: completedRequired.length,
        certificateNumber: certificateByCourseId.get(enrollment.courseId) ?? null,
      };
    });

    return {
      mode: "database" as DashboardMode,
      courses,
      summary: {
        activeCourses: courses.filter(
          (item) => item.enrollmentStatus === "ACTIVE",
        ).length,
        completedCourses: courses.filter(
          (item) =>
            item.enrollmentStatus === "COMPLETED" ||
            item.progressPercent === 100,
        ).length,
        requiredWork: courses.reduce(
          (total, item) =>
            total +
            Math.max(
              0,
              item.requiredAssessments - item.completedRequiredAssessments,
            ),
          0,
        ),
        certificatesEarned: courses.filter((item) => item.certificateNumber)
          .length,
      },
    };
  } catch {
    return {
      mode: "fallback" as DashboardMode,
      courses: [],
      summary: emptyLearnerSummary(),
    };
  }
}

export async function getLearnCourse(user: AppUser | null, courseId: string) {
  if (!databaseIsConfigured()) {
    return {
      mode: "fallback" as DashboardMode,
      course: null,
      completedLessonIds: [] as string[],
    };
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

export async function getCourseStudents(
  user: AppUser | null,
  courseId: string,
) {
  if (!databaseIsConfigured()) {
    return {
      mode: "fallback" as DashboardMode,
      students: [],
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
          userId: {
            in: course.enrollments.map((enrollment) => enrollment.userId),
          },
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
      stats: emptyAdminStats(),
      users: [],
    };
  }

  if (user?.role !== "ADMIN") {
    return { mode: "permission" as DashboardMode, stats: [], users: [] };
  }

  const [users, courses, enrollments, payments, recentUsers] =
    await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.enrollment.count(),
      prisma.payment.aggregate({
        _sum: { amountCents: true },
        where: { status: "PAID" },
      }),
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

function emptyOverview() {
  return {
    mode: "fallback" as DashboardMode,
    stats: emptyStats(),
    courses: [],
  };
}

function emptyStats() {
  return [
    { label: "Active enrollments", value: "0" },
    { label: "Published courses", value: "0" },
    { label: "Completion rate", value: "0%" },
    { label: "Revenue this month", value: formatPrice(0) },
  ];
}

function emptyAdminStats() {
  return [
    { label: "Users", value: "0" },
    { label: "Courses", value: "0" },
    { label: "Enrollments", value: "0" },
    { label: "Payments", value: formatPrice(0) },
  ];
}

function emptyLearnerSummary() {
  return {
    activeCourses: 0,
    completedCourses: 0,
    requiredWork: 0,
    certificatesEarned: 0,
  };
}

function scopeCoursesToUser(user: AppUser | null) {
  if (!user || user.role === "ADMIN") return {};
  if (user.role === "INSTRUCTOR") return { instructorId: user.id };
  return { enrollments: { some: { userId: user.id } } };
}
