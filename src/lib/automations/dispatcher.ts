import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  sendEnrollmentEmail,
  sendCourseCompletionEmail,
  sendCertificateIssuedEmail,
  sendInactivityNudgeEmail,
} from "@/lib/email";

export const MAX_ATTEMPTS = 5;
export const LEASE_MS = 60_000;
export function retryAt(attempt: number, now = new Date()) {
  return new Date(
    now.getTime() + Math.min(3_600_000, 30_000 * 2 ** Math.max(0, attempt - 1)),
  );
}
export function automationExecutionMode() {
  return "database-worker" as const;
}
export type AutomationRunOutcome = {
  status: "SUCCEEDED" | "FAILED" | "SKIPPED" | "PENDING" | "RUNNING";
  error?: string;
};

// Dispatch is deliberately enqueue-only. The separately supervised worker owns delivery.
export async function dispatchAutomationRun(
  runId: string,
): Promise<AutomationRunOutcome> {
  const run = await prisma.automationRun.findUnique({
    where: { id: runId },
    select: { status: true },
  });
  return run
    ? { status: run.status }
    : { status: "FAILED", error: "Automation run not found." };
}

export function automationDue(now: Date): Prisma.AutomationRunWhereInput {
  return {
    attempts: { lt: MAX_ATTEMPTS },
    OR: [
      {
        status: "PENDING",
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      { status: "RUNNING", leaseExpiresAt: { lte: now } },
    ],
  };
}

export async function processAutomationRun(
  runId: string,
): Promise<AutomationRunOutcome> {
  const now = new Date();
  const leaseToken = crypto.randomUUID();
  const claimed = await prisma.automationRun.updateMany({
    where: { id: runId, ...automationDue(now) },
    data: {
      status: "RUNNING",
      leaseToken,
      leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      attempts: { increment: 1 },
    },
  });
  if (!claimed.count) return dispatchAutomationRun(runId);
  const run = await prisma.automationRun.findUniqueOrThrow({
    where: { id: runId },
    include: { rule: true, learningEvent: true },
  });
  let outcome: AutomationRunOutcome;
  try {
    outcome = await executeRunAction(run, leaseToken);
  } catch {
    // Provider responses can include credentials or recipient data. Persist only a fixed diagnostic.
    outcome = {
      status: "FAILED",
      error:
        "Email provider delivery failed. Check provider configuration and availability.",
    };
    await prisma.notificationDelivery.updateMany({
      where: {
        automationRunId: run.id,
        status: "PENDING",
        automationRun: { leaseToken },
      },
      data: { status: "FAILED", error: outcome.error },
    });
  }
  const retry = outcome.status === "FAILED" && run.attempts < MAX_ATTEMPTS;
  await prisma.automationRun.updateMany({
    where: { id: run.id, leaseToken },
    data: {
      status: retry ? "PENDING" : outcome.status,
      error: outcome.error ?? null,
      nextRetryAt: retry ? retryAt(run.attempts) : null,
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
  return retry ? { ...outcome, status: "PENDING" } : outcome;
}

const handlers = {
  "email.enrollment_welcome": sendEnrollmentEmail,
  "email.course_completion": sendCourseCompletionEmail,
  "email.certificate_issued": sendCertificateIssuedEmail,
  "email.inactivity_nudge": sendInactivityNudgeEmail,
};
async function executeRunAction(
  run: Prisma.AutomationRunGetPayload<{
    include: { rule: true; learningEvent: true };
  }>,
  leaseToken: string,
): Promise<AutomationRunOutcome> {
  if (!run.rule || !run.rule.enabled)
    return { status: "SKIPPED", error: "Rule is disabled or deleted." };
  const handler = handlers[run.rule.actionType as keyof typeof handlers];
  if (!handler) return { status: "SKIPPED", error: "Unsupported action type." };
  const payload = (run.learningEvent?.payload ?? {}) as Prisma.JsonObject;
  const recipient =
    typeof payload.email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)
      ? payload.email
      : null;
  const idempotencyKey = `automation:${run.id}`;
  const delivery = await prisma.notificationDelivery.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      organizationId: run.organizationId,
      automationRunId: run.id,
      idempotencyKey,
      channel: "email",
      recipient: recipient ?? "(unknown)",
      template: run.rule.actionType,
      status: recipient ? "PENDING" : "SKIPPED",
    },
  });
  if (delivery.status === "SENT") return { status: "SUCCEEDED" };
  if (!recipient)
    return {
      status: "SKIPPED",
      error: "Learning event is missing a valid recipient email.",
    };
  const pending = await prisma.notificationDelivery.updateMany({
    where: { id: delivery.id, automationRun: { leaseToken } },
    data: { status: "PENDING", error: null },
  });
  if (!pending.count) return { status: "RUNNING" };
  const result = await handler({
    to: recipient,
    name: typeof payload.userName === "string" ? payload.userName : undefined,
    courseTitle:
      typeof payload.courseTitle === "string" ? payload.courseTitle : undefined,
    idempotencyKey,
  });
  const sent = result.provider !== "stub" && result.accepted;
  const error = sent
    ? null
    : "Email was not sent: a delivery provider is not active.";
  await prisma.notificationDelivery.updateMany({
    where: { id: delivery.id, automationRun: { leaseToken } },
    data: {
      status: sent ? "SENT" : "SKIPPED",
      sentAt: sent ? new Date() : null,
      error,
    },
  });
  return {
    status: sent ? "SUCCEEDED" : "SKIPPED",
    ...(error ? { error } : {}),
  };
}
