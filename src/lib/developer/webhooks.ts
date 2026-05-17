import { createHmac, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashApiSecret } from "@/lib/developer/api-keys";

export const webhookEventTypes = [
  "user.created",
  "organization.member.created",
  "organization.invitation.created",
  "course.published",
  "enrollment.created",
  "lesson.completed",
  "assessment.submission.created",
  "assessment.passed",
  "assessment.failed",
  "course.completed",
  "certificate.issued",
  "payment.succeeded",
  "payment.failed",
] as const;

export type WebhookEventType = (typeof webhookEventTypes)[number];

export type WebhookPayload = {
  id: string;
  type: string;
  createdAt: string;
  organizationId: string;
  data: Record<string, unknown>;
  apiVersion: "2026-05-17";
};

export function createWebhookSecret(
  entropy = randomBytes(24).toString("base64url"),
) {
  return `whsec_${entropy}`;
}

export function signWebhookPayload(input: {
  secret: string;
  timestamp: number;
  body: string;
}) {
  return createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.body}`)
    .digest("hex");
}

export function buildWebhookSignatureHeader(input: {
  secret: string;
  timestamp?: number;
  body: string;
}) {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const signature = signWebhookPayload({
    secret: input.secret,
    timestamp,
    body: input.body,
  });
  return `t=${timestamp},v1=${signature}`;
}

export async function createWebhookEndpoint(input: {
  organizationId: string;
  url: string;
  eventTypes: string[];
  createdById?: string | null;
}) {
  const secret = createWebhookSecret();
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      organizationId: input.organizationId,
      url: input.url,
      eventTypes: input.eventTypes.filter(isWebhookEventType),
      secretHash: hashApiSecret(secret),
      createdById: input.createdById ?? null,
    },
  });
  return { endpoint, secret };
}

export async function enqueueWebhookDeliveries(input: {
  organizationId: string;
  type: WebhookEventType | string;
  data: Record<string, unknown>;
}) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      organizationId: input.organizationId,
      active: true,
      OR: [
        { eventTypes: { has: input.type } },
        { eventTypes: { isEmpty: true } },
      ],
    },
  });
  if (endpoints.length === 0) return { count: 0 };

  const payload = {
    id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
    type: input.type,
    createdAt: new Date().toISOString(),
    organizationId: input.organizationId,
    data: input.data,
    apiVersion: "2026-05-17" as const,
  } satisfies WebhookPayload;

  return prisma.webhookDelivery.createMany({
    data: endpoints.map((endpoint) => ({
      endpointId: endpoint.id,
      eventType: input.type,
      payload: payload as unknown as Prisma.InputJsonObject,
    })),
  });
}

export function isWebhookEventType(type: string): type is WebhookEventType {
  return webhookEventTypes.includes(type as WebhookEventType);
}
