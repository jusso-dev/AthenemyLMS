import { createHmac, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveWebhookDestination } from "@/lib/developer/webhook-transport";
import { encryptWebhookSecret } from "@/lib/developer/webhook-secrets";
import { hashApiSecret } from "@/lib/developer/api-keys";

export const webhookEventTypes = [
  "enrollment.created",
  "lesson.completed",
  "assessment.passed",
  "assessment.failed",
  "course.completed",
  "certificate.issued",
  "payment.succeeded",
  "payment.failed",
  "payment.refunded",
  "payment.disputed",
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
  if (
    typeof input.url !== "string" ||
    !Array.isArray(input.eventTypes) ||
    input.eventTypes.some((type) => !isWebhookEventType(type))
  )
    throw Object.assign(new Error("Invalid webhook URL or event types."), {
      status: 400,
      code: "invalid_request",
    });
  await resolveWebhookDestination(input.url);
  const secret = createWebhookSecret();
  const signingSecretEncrypted = encryptWebhookSecret(
    secret,
    input.organizationId,
  );
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      organizationId: input.organizationId,
      url: input.url,
      eventTypes: input.eventTypes.filter(isWebhookEventType),
      secretHash: hashApiSecret(secret),
      signingSecretEncrypted,
      createdById: input.createdById ?? null,
    },
    select: {
      id: true,
      organizationId: true,
      url: true,
      eventTypes: true,
      active: true,
      createdAt: true,
    },
  });
  return { endpoint, secret };
}

export async function enqueueWebhookDeliveries(
  input: {
    organizationId: string;
    type: WebhookEventType | string;
    data: Record<string, unknown>;
    eventKey?: string;
  },
  db: Prisma.TransactionClient = prisma,
) {
  const endpoints = await db.webhookEndpoint.findMany({
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
    id: input.eventKey ?? `evt_${crypto.randomUUID().replaceAll("-", "")}`,
    type: input.type,
    createdAt: new Date().toISOString(),
    organizationId: input.organizationId,
    data: input.data,
    apiVersion: "2026-05-17" as const,
  } satisfies WebhookPayload;

  return db.webhookDelivery.createMany({
    skipDuplicates: true,
    data: endpoints.map((endpoint) => ({
      endpointId: endpoint.id,
      eventKey: input.eventKey ?? payload.id,
      eventType: input.type,
      payload: payload as unknown as Prisma.InputJsonObject,
    })),
  });
}

export function isWebhookEventType(type: string): type is WebhookEventType {
  return webhookEventTypes.includes(type as WebhookEventType);
}
