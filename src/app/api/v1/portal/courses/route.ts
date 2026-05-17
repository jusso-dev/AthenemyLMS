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
      "courses:read",
    );
    const courses = await prisma.course.findMany({
      where: {
        organizationId: context.organizationId,
        status: "PUBLISHED",
      },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        subtitle: true,
        thumbnailUrl: true,
        priceCents: true,
        currency: true,
        level: true,
        durationMinutes: true,
      },
    });
    return apiJson({ data: courses });
  } catch (error) {
    return apiError(error);
  }
}
