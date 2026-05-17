import {
  authenticateApiRequest,
  requireApiScope,
} from "@/lib/developer/api-keys";
import { apiError, apiJson } from "@/lib/developer/api-response";
import {
  createWebhookEndpoint,
  webhookEventTypes,
} from "@/lib/developer/webhooks";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const context = requireApiScope(
      await authenticateApiRequest(request),
      "webhooks:read",
    );
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { organizationId: context.organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        eventTypes: true,
        active: true,
        lastDeliveryAt: true,
        createdAt: true,
      },
    });
    return apiJson({ data: endpoints, eventTypes: webhookEventTypes });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = requireApiScope(
      await authenticateApiRequest(request),
      "webhooks:write",
    );
    const body = (await request.json()) as {
      url?: string;
      eventTypes?: string[];
    };
    if (!body.url) {
      throw Object.assign(new Error("url is required."), {
        code: "invalid_request",
        status: 400,
      });
    }
    const { endpoint, secret } = await createWebhookEndpoint({
      organizationId: context.organizationId,
      url: body.url,
      eventTypes: body.eventTypes ?? [],
    });
    return apiJson({ data: endpoint, secret }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
