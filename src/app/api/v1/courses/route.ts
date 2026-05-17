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
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const context = requireApiScope(
      await authenticateApiRequest(request),
      "courses:read",
    );
    const url = new URL(request.url);
    const { take, cursor } = parsePagination(url);
    const courses = await prisma.course.findMany({
      where: {
        organizationId: context.organizationId,
        status:
          url.searchParams.get("status") === "draft" ? "DRAFT" : undefined,
      },
      orderBy: { updatedAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        slug: true,
        subtitle: true,
        status: true,
        priceCents: true,
        currency: true,
        requiredForMembers: true,
        autoEnrollFutureMembers: true,
        sourceTemplateId: true,
        sourceTemplateVersion: true,
        updatedAt: true,
      },
    });
    return apiJson({
      data: courses.slice(0, take),
      pageInfo: pageInfo(courses, take),
    });
  } catch (error) {
    return apiError(error);
  }
}
