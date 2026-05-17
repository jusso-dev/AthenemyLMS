import { Prisma } from "@prisma/client";
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
import { recordLearningEvent } from "@/lib/automations/events";
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
    const body = (await request.json()) as {
      userId?: string;
      email?: string;
      courseId?: string;
    };
    if (!body.courseId || (!body.userId && !body.email)) {
      throw Object.assign(
        new Error("courseId and either userId or email are required."),
        { code: "invalid_request", status: 400 },
      );
    }
    const course = await prisma.course.findFirst({
      where: { id: body.courseId, organizationId: context.organizationId },
      select: { id: true },
    });
    if (!course) {
      throw Object.assign(new Error("Course not found."), {
        code: "not_found",
        status: 404,
      });
    }
    const user = await prisma.user.findFirst({
      where: body.userId ? { id: body.userId } : { email: body.email },
      select: { id: true },
    });
    if (!user) {
      throw Object.assign(new Error("User not found."), {
        code: "not_found",
        status: 404,
      });
    }

    const enrollment = await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
      update: { status: "ACTIVE" },
      create: { userId: user.id, courseId: course.id, status: "ACTIVE" },
    });

    await recordLearningEvent({
      organizationId: context.organizationId,
      userId: user.id,
      courseId: course.id,
      type: "user.enrolled",
      payload: enrollment as unknown as Prisma.InputJsonObject,
      idempotencyKey:
        request.headers.get("idempotency-key") ??
        `enrollment:${user.id}:${course.id}`,
    });

    return apiJson({ data: enrollment }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
