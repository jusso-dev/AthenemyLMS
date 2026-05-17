import {
  authenticateApiRequest,
  requireApiScope,
} from "@/lib/developer/api-keys";
import { apiError, apiJson } from "@/lib/developer/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  contextInput: { params: Promise<{ courseId: string }> },
) {
  try {
    const context = requireApiScope(
      await authenticateApiRequest(request),
      "courses:read",
    );
    const { courseId } = await contextInput.params;
    const course = await prisma.course.findFirst({
      where: { id: courseId, organizationId: context.organizationId },
      include: {
        sections: {
          orderBy: { position: "asc" },
          include: {
            lessons: {
              orderBy: { position: "asc" },
              select: {
                id: true,
                title: true,
                slug: true,
                durationMinutes: true,
                preview: true,
                position: true,
              },
            },
          },
        },
        assessments: {
          select: {
            id: true,
            title: true,
            requiredForCompletion: true,
            passingScore: true,
          },
        },
      },
    });
    if (!course) {
      throw Object.assign(new Error("Course not found."), {
        code: "not_found",
        status: 404,
      });
    }
    return apiJson({ data: course });
  } catch (error) {
    return apiError(error);
  }
}
