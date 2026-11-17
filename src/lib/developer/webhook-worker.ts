import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MAX_ATTEMPTS, LEASE_MS, retryAt } from "@/lib/automations/dispatcher";
import { buildWebhookSignatureHeader } from "@/lib/developer/webhooks";
import { decryptWebhookSecret } from "@/lib/developer/webhook-secrets";
import { deliverWebhook } from "@/lib/developer/webhook-transport";

export function webhookDue(now: Date): Prisma.WebhookDeliveryWhereInput {
  return {
    attempts: { lt: MAX_ATTEMPTS },
    status: { in: ["PENDING", "RETRYING"] },
    AND: [
      { OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
      { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
    ],
  };
}
export async function processWebhookDelivery(deliveryId: string) {
  const now = new Date();
  const leaseToken = crypto.randomUUID();
  const delivery = await prisma.$transaction(async (tx) => {
    const claimed = await tx.webhookDelivery.updateMany({
      where: { id: deliveryId, ...webhookDue(now) },
      data: {
        status: "RETRYING",
        leaseToken,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        attempts: { increment: 1 },
      },
    });
    if (!claimed.count) return null;
    const row = await tx.webhookDelivery.findUniqueOrThrow({
      where: { id: deliveryId },
      include: { endpoint: true },
    });
    await tx.webhookDeliveryAttempt.create({
      data: {
        deliveryId,
        attempt: row.attempts,
        error:
          "Attempt started; outcome pending or unknown if the worker stops.",
      },
    });
    return row;
  });
  if (!delivery) return false;
  let statusCode: number | null = null;
  let error: string | null = null;
  const started = Date.now();
  try {
    if (!delivery.endpoint.active) throw new Error("disabled");
    if (!delivery.endpoint.signingSecretEncrypted)
      throw new Error("missing signing secret");
    const secret = decryptWebhookSecret(
      delivery.endpoint.signingSecretEncrypted,
      delivery.endpoint.organizationId,
    );
    const body = JSON.stringify(delivery.payload);
    statusCode = await deliverWebhook(
      delivery.endpoint.url,
      body,
      buildWebhookSignatureHeader({ secret, body }),
      delivery.id,
    );
    if (statusCode < 200 || statusCode >= 300)
      error = `Endpoint returned HTTP ${statusCode}.`;
  } catch {
    error =
      "Delivery failed. Check endpoint, public HTTPS destination, and signing configuration.";
  }
  const retryable =
    delivery.endpoint.active &&
    (statusCode === null ||
      statusCode === 408 ||
      statusCode === 429 ||
      statusCode >= 500);
  const retry = Boolean(error && retryable && delivery.attempts < MAX_ATTEMPTS);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.webhookDelivery.updateMany({
      where: { id: deliveryId, leaseToken },
      data: {
        status: error ? (retry ? "RETRYING" : "FAILED") : "DELIVERED",
        statusCode,
        responseSummary: error,
        durationMs: Date.now() - started,
        nextRetryAt: retry ? retryAt(delivery.attempts) : null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
    if (!updated.count) return;
    await tx.webhookDeliveryAttempt.update({
      where: { deliveryId_attempt: { deliveryId, attempt: delivery.attempts } },
      data: { statusCode, error, durationMs: Date.now() - started },
    });
    if (!error)
      await tx.webhookEndpoint.update({
        where: { id: delivery.endpointId },
        data: { lastDeliveryAt: new Date() },
      });
  });
  return true;
}

/** Caller must authenticate an organization administrator before invoking this function. */
export async function replayWebhookDelivery(
  organizationId: string,
  deliveryId: string,
) {
  // Keep attempt history and payload/event ID. A fresh row gives replay its own bounded retry budget.
  return prisma.$transaction(async (tx) => {
    const original = await tx.webhookDelivery.findFirst({
      where: {
        id: deliveryId,
        status: "FAILED",
        endpoint: { organizationId, active: true },
      },
    });
    if (!original)
      throw new Error("Failed delivery not found in this organization.");
    const eventKey = `replay:${original.id}`;
    return tx.webhookDelivery.upsert({
      where: {
        endpointId_eventKey: { endpointId: original.endpointId, eventKey },
      },
      update: {},
      create: {
        endpointId: original.endpointId,
        eventKey,
        eventType: original.eventType,
        payload: original.payload as Prisma.InputJsonValue,
      },
    });
  });
}
