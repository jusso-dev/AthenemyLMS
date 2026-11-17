import { prisma } from "@/lib/prisma";
import { evaluateAutomationRules } from "@/lib/automations/events";
import {
  automationDue,
  MAX_ATTEMPTS,
  processAutomationRun,
} from "@/lib/automations/dispatcher";
import {
  enqueueWebhookDeliveries,
  isWebhookEventType,
} from "@/lib/developer/webhooks";
import {
  processWebhookDelivery,
  webhookDue,
} from "@/lib/developer/webhook-worker";

export async function fanOutLearningEvent(eventId: string) {
  return prisma.$transaction(async (tx) => {
    // Atomic marker/row lock, rolled back together with all fanout writes on failure.
    const claimed = await tx.learningEvent.updateMany({
      where: { id: eventId, dispatchedAt: null },
      data: { dispatchedAt: new Date() },
    });
    if (!claimed.count) return false;
    const event = await tx.learningEvent.findUniqueOrThrow({
      where: { id: eventId },
    });
    if (!event.organizationId) return true;
    const payload =
      event.payload &&
      typeof event.payload === "object" &&
      !Array.isArray(event.payload)
        ? event.payload
        : {};
    await evaluateAutomationRules(
      event.organizationId,
      event.id,
      event.type,
      tx,
      event.type === "learner.inactive" && typeof payload.ruleId === "string"
        ? (payload.ruleId as string)
        : undefined,
    );
    const type =
      (
        {
          "user.enrolled": "enrollment.created",
          "user.invited": "organization.invitation.created",
          "user.joined_organization": "organization.member.created",
        } as Record<string, string>
      )[event.type] ?? event.type;
    if (isWebhookEventType(type))
      await enqueueWebhookDeliveries(
        {
          organizationId: event.organizationId,
          type,
          eventKey: event.id,
          data: {
            ...payload,
            userId: event.userId,
            courseId: event.courseId,
          },
        },
        tx,
      );
    return true;
  });
}

export async function runWorkerBatch(limit = 25) {
  const now = new Date();
  // Exhausted final claims must not remain RUNNING forever after a process crash.
  await prisma.automationRun.updateMany({
    where: {
      status: "RUNNING",
      attempts: { gte: MAX_ATTEMPTS },
      leaseExpiresAt: { lte: now },
    },
    data: {
      status: "FAILED",
      leaseToken: null,
      leaseExpiresAt: null,
      error:
        "Worker lease expired after final attempt; inspect provider before manual retry.",
    },
  });
  await prisma.webhookDelivery.updateMany({
    where: {
      status: "RETRYING",
      attempts: { gte: MAX_ATTEMPTS },
      leaseExpiresAt: { lte: now },
    },
    data: {
      status: "FAILED",
      leaseToken: null,
      leaseExpiresAt: null,
      responseSummary: "Worker lease expired after final attempt.",
    },
  });
  const events = await prisma.learningEvent.findMany({
    where: { dispatchedAt: null },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const event of events) await fanOutLearningEvent(event.id);
  const runs = await prisma.automationRun.findMany({
    where: automationDue(new Date()),
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const run of runs) await processAutomationRun(run.id);
  const deliveries = await prisma.webhookDelivery.findMany({
    where: webhookDue(new Date()),
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const delivery of deliveries) await processWebhookDelivery(delivery.id);
  return {
    events: events.length,
    automations: runs.length,
    webhooks: deliveries.length,
  };
}
