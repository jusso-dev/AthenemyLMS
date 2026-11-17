import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const automationEventTypes = [
  "user.invited",
  "user.joined_organization",
  "user.enrolled",
  "lesson.completed",
  "assessment.passed",
  "assessment.failed",
  "course.completed",
  "certificate.issued",
  "payment.succeeded",
  "payment.failed",
  "learner.inactive",
] as const;

export type AutomationEventType = (typeof automationEventTypes)[number];

export type LearningEventInput = {
  organizationId?: string | null;
  userId?: string | null;
  courseId?: string | null;
  type: AutomationEventType | string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
};

/** Pass the business mutation's transaction to commit its event atomically. */
export async function recordLearningEvent(
  input: LearningEventInput,
  db: Prisma.TransactionClient = prisma,
) {
  const standaloneId =
    !input.organizationId && input.idempotencyKey
      ? `evt_${createHash("sha256").update(input.idempotencyKey).digest("hex")}`
      : crypto.randomUUID();
  return db.learningEvent.upsert({
    where:
      input.organizationId && input.idempotencyKey
        ? {
            organizationId_idempotencyKey: {
              organizationId: input.organizationId,
              idempotencyKey: input.idempotencyKey,
            },
          }
        : { id: standaloneId },
    update: {},
    create: {
      id: standaloneId,
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      courseId: input.courseId ?? null,
      type: input.type,
      payload: (input.payload ?? {}) as Prisma.InputJsonObject,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });
}

export async function evaluateAutomationRules(
  organizationId: string,
  learningEventId: string,
  eventType: string,
  db: Prisma.TransactionClient = prisma,
  ruleId?: string,
) {
  const rules = await db.automationRule.findMany({
    where: {
      organizationId,
      enabled: true,
      eventType,
      ...(ruleId ? { id: ruleId } : {}),
    },
  });
  await db.automationRun.createMany({
    data: rules.map((rule) => ({
      organizationId,
      ruleId: rule.id,
      learningEventId,
      metadata: { actionType: rule.actionType },
    })),
    skipDuplicates: true,
  });
  const runs = await db.automationRun.findMany({
    where: { organizationId, learningEventId },
    select: { id: true },
  });
  return { count: runs.length, runIds: runs.map((run) => run.id) };
}

export function triggerDevConfigured() {
  return Boolean(process.env.TRIGGER_SECRET_KEY || process.env.TRIGGER_API_KEY);
}

export const builtInAutomationRecipes = [
  {
    name: "Enrollment welcome",
    eventType: "user.enrolled",
    actionType: "email.enrollment_welcome",
    config: {
      template: "enrollment_welcome",
      subject: "Welcome to {{courseTitle}}",
    },
  },
  {
    name: "Course completion",
    eventType: "course.completed",
    actionType: "email.course_completion",
    config: {
      template: "course_completion",
      subject: "Course completed: {{courseTitle}}",
    },
  },
  {
    name: "Certificate issued",
    eventType: "certificate.issued",
    actionType: "email.certificate_issued",
    config: {
      template: "certificate_issued",
      subject: "Your certificate is ready",
    },
  },
  {
    name: "Learner inactivity nudge",
    eventType: "learner.inactive",
    actionType: "email.inactivity_nudge",
    config: {
      template: "inactivity_nudge",
      inactiveDays: 7,
    },
  },
];
