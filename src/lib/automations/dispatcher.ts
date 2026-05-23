import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEnrollmentEmail } from "@/lib/email";
import { triggerDevConfigured } from "@/lib/automations/events";

export type AutomationExecutionMode = "inline" | "trigger.dev";

export function automationExecutionMode(): AutomationExecutionMode {
  return triggerDevConfigured() ? "trigger.dev" : "inline";
}

export type AutomationRunOutcome = {
  status: "SUCCEEDED" | "FAILED" | "SKIPPED";
  error?: string;
};

/**
 * Boundary for dispatching an automation run. The current implementation always
 * processes inline so a self-hoster can ship without Trigger.dev. When the
 * Trigger.dev SDK is wired in (Phase 2 of #37), this is the seam that flips
 * dispatch to `tasks.processAutomationRun.trigger({ runId })`.
 */
export async function dispatchAutomationRun(
  runId: string,
): Promise<AutomationRunOutcome> {
  return processAutomationRun(runId);
}

export async function processAutomationRun(
  runId: string,
): Promise<AutomationRunOutcome> {
  const run = await prisma.automationRun.findUnique({
    where: { id: runId },
    include: {
      rule: true,
      learningEvent: true,
    },
  });
  if (!run) return { status: "FAILED", error: "Automation run not found." };
  if (run.status === "SUCCEEDED" || run.status === "SKIPPED") {
    return { status: run.status };
  }

  await prisma.automationRun.update({
    where: { id: runId },
    data: { status: "RUNNING" },
  });

  try {
    const outcome = await executeRunAction(run);
    await prisma.automationRun.update({
      where: { id: runId },
      data: {
        status: outcome.status,
        error: outcome.error ?? null,
        metadata: {
          ...((run.metadata as Prisma.JsonObject | null) ?? {}),
          executionMode: automationExecutionMode(),
          completedAt: new Date().toISOString(),
        },
      },
    });
    return outcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.automationRun.update({
      where: { id: runId },
      data: { status: "FAILED", error: message },
    });
    return { status: "FAILED", error: message };
  }
}

async function executeRunAction(
  run: Prisma.AutomationRunGetPayload<{
    include: { rule: true; learningEvent: true };
  }>,
): Promise<AutomationRunOutcome> {
  if (!run.rule) {
    return { status: "SKIPPED", error: "Rule was deleted before execution." };
  }

  const payload =
    (run.learningEvent?.payload as Prisma.JsonObject | null) ?? {};

  switch (run.rule.actionType) {
    case "email.enrollment_welcome":
      return runEnrollmentWelcome(run, payload);
    case "email.course_completion":
    case "email.certificate_issued":
    case "email.inactivity_nudge":
      // Templates land with their delivery code in Phase 2 — they still get a
      // recorded delivery so admins can see what would have been sent.
      return runDeferredEmail(run, payload);
    default:
      return {
        status: "SKIPPED",
        error: `Unsupported action type: ${run.rule.actionType}`,
      };
  }
}

async function runEnrollmentWelcome(
  run: Prisma.AutomationRunGetPayload<{
    include: { rule: true; learningEvent: true };
  }>,
  payload: Prisma.JsonObject,
): Promise<AutomationRunOutcome> {
  const recipient = typeof payload.email === "string" ? payload.email : null;
  const courseTitle =
    typeof payload.courseTitle === "string" ? payload.courseTitle : undefined;

  const delivery = await prisma.notificationDelivery.create({
    data: {
      organizationId: run.organizationId,
      automationRunId: run.id,
      channel: "email",
      recipient: recipient ?? "(unknown)",
      template: "enrollment_welcome",
      status: recipient ? "PENDING" : "SKIPPED",
      metadata: { courseTitle: courseTitle ?? null },
    },
  });

  if (!recipient) {
    return {
      status: "SKIPPED",
      error: "Learning event payload missing recipient email.",
    };
  }

  try {
    await sendEnrollmentEmail({
      to: recipient,
      name: typeof payload.userName === "string" ? payload.userName : undefined,
      courseTitle,
    });
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return { status: "SUCCEEDED" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", error: message },
    });
    return { status: "FAILED", error: message };
  }
}

async function runDeferredEmail(
  run: Prisma.AutomationRunGetPayload<{
    include: { rule: true; learningEvent: true };
  }>,
  payload: Prisma.JsonObject,
): Promise<AutomationRunOutcome> {
  const recipient = typeof payload.email === "string" ? payload.email : "(unknown)";
  await prisma.notificationDelivery.create({
    data: {
      organizationId: run.organizationId,
      automationRunId: run.id,
      channel: "email",
      recipient,
      template: run.rule?.actionType ?? "deferred",
      status: "PENDING",
      metadata: { reason: "Template handler ships in Phase 2 of #37." },
    },
  });
  return { status: "SKIPPED", error: "Template handler not yet implemented." };
}
