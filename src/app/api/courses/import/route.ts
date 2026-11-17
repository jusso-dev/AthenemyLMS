import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentAppUser } from "@/lib/auth";
import { missingEnv } from "@/lib/env";
import { authorableOrganizationIds, canAuthorCourses } from "@/lib/permissions";
import { importCourse } from "@/lib/course-import-export";

export async function POST(request: Request) {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const user = await getCurrentAppUser();
  if (!user || !canAuthorCourses(user)) {
    return NextResponse.json(
      { error: "Course authoring access is required." },
      { status: 403 },
    );
  }

  try {
    const course = await importCourse(
      await request.json(),
      user.id,
      authorableOrganizationIds(user)[0],
    );
    return NextResponse.json(
      { id: course.id, slug: course.slug },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid course export file.", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON file." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Course import failed. Please try again." },
      { status: 500 },
    );
  }
}
