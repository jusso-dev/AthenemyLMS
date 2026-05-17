import {
  authenticateApiRequest,
  requireApiScope,
} from "@/lib/developer/api-keys";
import { apiError, apiJson } from "@/lib/developer/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  contextInput: { params: Promise<{ certificateId: string }> },
) {
  try {
    const context = requireApiScope(
      await authenticateApiRequest(request),
      "certificates:read",
    );
    const { certificateId } = await contextInput.params;
    const certificate = await prisma.certificate.findFirst({
      where: {
        id: certificateId,
        course: { organizationId: context.organizationId },
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        course: { select: { id: true, title: true, slug: true } },
      },
    });
    if (!certificate) {
      throw Object.assign(new Error("Certificate not found."), {
        code: "not_found",
        status: 404,
      });
    }
    return apiJson({ data: certificate });
  } catch (error) {
    return apiError(error);
  }
}
