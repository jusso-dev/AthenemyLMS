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
      "org:read",
    );
    const organization = await prisma.organization.findUnique({
      where: { id: context.organizationId },
      select: { id: true, name: true, slug: true, supportEmail: true },
    });
    return apiJson({
      apiKey: { id: context.apiKeyId, scopes: context.scopes },
      organization,
    });
  } catch (error) {
    return apiError(error);
  }
}
