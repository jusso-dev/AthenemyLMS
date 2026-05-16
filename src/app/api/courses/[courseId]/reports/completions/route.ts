import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/analytics";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const user = await getCurrentAppUser();
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      sections: { include: { lessons: { select: { id: true } } } },
      enrollments: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
      certificates: true,
      assessments: {
        where: { requiredForCompletion: true },
        include: { submissions: true },
      },
    },
  });

  if (!course || !canManageCourse(user, course)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const lessonIds = course.sections.flatMap((section) =>
    section.lessons.map((lesson) => lesson.id),
  );
  const progress = lessonIds.length
    ? await prisma.lessonProgress.findMany({
        where: {
          lessonId: { in: lessonIds },
          userId: { in: course.enrollments.map((item) => item.userId) },
          completedAt: { not: null },
        },
        select: { userId: true, lessonId: true },
      })
    : [];

  const rows = course.enrollments.map((enrollment) => {
    const completedLessons = progress.filter(
      (item) => item.userId === enrollment.userId,
    ).length;
    const submissions = course.assessments.flatMap((assessment) =>
      assessment.submissions.filter(
        (submission) => submission.userId === enrollment.userId,
      ),
    );
    const certificate = course.certificates.find(
      (item) => item.userId === enrollment.userId,
    );

    return {
      learner: enrollment.user.name ?? "",
      email: enrollment.user.email,
      enrollmentStatus: enrollment.status,
      progressPercent: lessonIds.length
        ? Math.round((completedLessons / lessonIds.length) * 100)
        : 0,
      completedLessons,
      totalLessons: lessonIds.length,
      requiredAssessmentsPassed: submissions.filter(
        (submission) => submission.passed,
      ).length,
      requiredAssessments: course.assessments.length,
      certificateIssuedAt: certificate?.issuedAt.toISOString() ?? "",
    };
  });

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${course.slug}-completion-report.csv"`,
    },
  });
}
