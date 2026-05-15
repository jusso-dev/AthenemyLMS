import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { missingEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { canManageCourse } from "@/lib/permissions";
import { buildCourseExport } from "@/lib/course-import-export";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const user = await getCurrentAppUser();
  const { courseId } = await params;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!canManageCourse(user, course)) {
    return NextResponse.json({ error: "Course export is not permitted." }, { status: 403 });
  }

  const body = await buildCourseExport(courseId);
  return NextResponse.json(body, {
    headers: {
      "content-disposition": `attachment; filename="${body.course.slug}.athenemy-course.json"`,
    },
  });
}
