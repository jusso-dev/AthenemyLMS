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
      "certificates:read",
    );
    const url = new URL(request.url);
    const { take, cursor } = parsePagination(url);
    const certificates = await prisma.certificate.findMany({
      where: {
        course: { organizationId: context.organizationId },
        userId: url.searchParams.get("userId") ?? undefined,
        courseId: url.searchParams.get("courseId") ?? undefined,
      },
      orderBy: { issuedAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, email: true, name: true } },
        course: { select: { id: true, title: true, slug: true } },
      },
    });
    return apiJson({
      data: certificates.slice(0, take),
      pageInfo: pageInfo(certificates, take),
    });
  } catch (error) {
    return apiError(error);
  }
}
