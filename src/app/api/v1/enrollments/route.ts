import { z } from "zod";
import {
  authenticateApiRequest,
  requireApiScope,
} from "@/lib/developer/api-keys";
import {
  apiError,
  apiJson,
  pageInfo,
  parsePagination,
} from "@/lib/developer/api-response";
import { recordCourseEvent } from "@/lib/learning-events";
import { learningTransaction } from "@/lib/learning";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const context = requireApiScope(
      await authenticateApiRequest(request),
      "enrollments:read",
    );
    const url = new URL(request.url);
    const { take, cursor } = parsePagination(url);
    const enrollments = await prisma.enrollment.findMany({
      where: {
        course: { organizationId: context.organizationId },
        userId: url.searchParams.get("userId") ?? undefined,
        courseId: url.searchParams.get("courseId") ?? undefined,
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, email: true, name: true } },
        course: { select: { id: true, title: true, slug: true } },
      },
    });
    return apiJson({
      data: enrollments.slice(0, take),
      pageInfo: pageInfo(enrollments, take),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = requireApiScope(
      await authenticateApiRequest(request),
      "enrollments:write",
    );
    const parsed = z
      .object({
        userId: z.string().min(1).max(200).optional(),
        email: z.string().email().max(320).optional(),
        courseId: z.string().min(1).max(200),
      })
      .refine((value) => Boolean(value.userId || value.email))
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      throw Object.assign(
        new Error("courseId and either a valid userId or email are required."),
        { code: "invalid_request", status: 400 },
      );
    const body = parsed.data;
    const enrollment = await learningTransaction(async (tx) => {
      const course = await tx.course.findFirst({
        where: { id: body.courseId, organizationId: context.organizationId },
        select: { id: true },
      });
      if (!course)
        throw Object.assign(new Error("Course not found."), {
          code: "not_found",
          status: 404,
        });
      const user = await tx.user.findFirst({
        where: {
          ...(body.userId ? { id: body.userId } : { email: body.email }),
          organizationMemberships: {
            some: { organizationId: context.organizationId },
          },
        },
        select: { id: true },
      });
      if (!user)
        throw Object.assign(new Error("Organization member not found."), {
          code: "not_found",
          status: 404,
        });
      const current = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
      });
      if (current?.status === "ACTIVE" || current?.status === "COMPLETED")
        return current;
      const result = await tx.enrollment.upsert({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        update: { status: "ACTIVE" },
        create: { userId: user.id, courseId: course.id, status: "ACTIVE" },
      });
      await recordCourseEvent(tx, {
        userId: user.id,
        courseId: course.id,
        type: "user.enrolled",
        idempotencyKey: `api-enrollment:${result.id}:${result.updatedAt.toISOString()}`,
      });
      return result;
    });

    return apiJson({ data: enrollment }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
