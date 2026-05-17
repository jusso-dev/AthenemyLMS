import {
  authenticateApiRequest,
  requireApiScope,
} from "@/lib/developer/api-keys";
import { apiError, apiJson } from "@/lib/developer/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const context = requireApiScope(
      await authenticateApiRequest(request),
      "progress:read",
    );
    const url = new URL(request.url);
    const courseId = url.searchParams.get("courseId") ?? undefined;
    const userId = url.searchParams.get("userId") ?? undefined;
    const progress = await prisma.lessonProgress.findMany({
      where: {
        userId,
        lesson: {
          section: {
            course: {
              organizationId: context.organizationId,
              id: courseId,
            },
          },
        },
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            section: { select: { courseId: true } },
          },
        },
      },
      orderBy: { lastSeenAt: "desc" },
      take: 100,
    });
    return apiJson({ data: progress });
  } catch (error) {
    return apiError(error);
  }
}
