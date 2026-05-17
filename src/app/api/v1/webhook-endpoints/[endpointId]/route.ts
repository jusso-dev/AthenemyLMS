import {
  authenticateApiRequest,
  requireApiScope,
} from "@/lib/developer/api-keys";
import { apiError, apiJson } from "@/lib/developer/api-response";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  contextInput: { params: Promise<{ endpointId: string }> },
) {
  try {
    const context = requireApiScope(
      await authenticateApiRequest(request),
      "webhooks:write",
    );
    const { endpointId } = await contextInput.params;
    const body = (await request.json()) as {
      url?: string;
      eventTypes?: string[];
      active?: boolean;
    };
    const endpoint = await prisma.webhookEndpoint.update({
      where: { id: endpointId, organizationId: context.organizationId },
      data: {
        url: body.url,
        eventTypes: body.eventTypes,
        active: body.active,
      },
    });
    return apiJson({ data: endpoint });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  contextInput: { params: Promise<{ endpointId: string }> },
) {
  try {
    const context = requireApiScope(
      await authenticateApiRequest(request),
      "webhooks:write",
    );
    const { endpointId } = await contextInput.params;
    await prisma.webhookEndpoint.delete({
      where: { id: endpointId, organizationId: context.organizationId },
    });
    return apiJson({ data: { deleted: true } });
  } catch (error) {
    return apiError(error);
  }
}
