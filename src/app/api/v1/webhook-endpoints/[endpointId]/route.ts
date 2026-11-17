import {
  authenticateApiRequest,
  requireApiScope,
} from "@/lib/developer/api-keys";
import { apiError, apiJson } from "@/lib/developer/api-response";
import { resolveWebhookDestination } from "@/lib/developer/webhook-transport";
import { isWebhookEventType } from "@/lib/developer/webhooks";
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
    if (
      !body ||
      (body.url !== undefined && typeof body.url !== "string") ||
      (body.active !== undefined && typeof body.active !== "boolean") ||
      (body.eventTypes !== undefined &&
        (!Array.isArray(body.eventTypes) ||
          body.eventTypes.some((type) => !isWebhookEventType(type))))
    )
      throw Object.assign(new Error("Invalid webhook settings."), {
        status: 400,
        code: "invalid_request",
      });
    const current = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, organizationId: context.organizationId },
      select: { signingSecretEncrypted: true },
    });
    if (!current)
      throw Object.assign(new Error("Endpoint not found."), {
        status: 404,
        code: "not_found",
      });
    if (body.url !== undefined) await resolveWebhookDestination(body.url);
    if (body.active && !current.signingSecretEncrypted)
      throw Object.assign(
        new Error(
          "Recreate this legacy endpoint to provision its signing key.",
        ),
        { status: 400, code: "invalid_request" },
      );
    const endpoint = await prisma.webhookEndpoint.update({
      where: { id: endpointId, organizationId: context.organizationId },
      data: {
        url: body.url,
        eventTypes: body.eventTypes,
        active: body.active,
      },
      select: {
        id: true,
        url: true,
        eventTypes: true,
        active: true,
        lastDeliveryAt: true,
        createdAt: true,
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
