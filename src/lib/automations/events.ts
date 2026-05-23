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

export async function recordLearningEvent(input: {
  organizationId?: string | null;
  userId?: string | null;
  courseId?: string | null;
  type: AutomationEventType | string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
}) {
  const event = await prisma.learningEvent.upsert({
    where:
      input.organizationId && input.idempotencyKey
        ? {
            organizationId_idempotencyKey: {
              organizationId: input.organizationId,
              idempotencyKey: input.idempotencyKey,
            },
          }
        : { id: crypto.randomUUID() },
    update: {},
    create: {
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      courseId: input.courseId ?? null,
      type: input.type,
      payload: (input.payload ?? {}) as Prisma.InputJsonObject,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });

  if (event.organizationId) {
    try {
      await evaluateAutomationRules(event.organizationId, event.id, event.type);
    } catch (error) {
      console.error("[automations] rule evaluation failed", error);
    }
  }

  return event;
}

export async function evaluateAutomationRules(
  organizationId: string,
  learningEventId: string,
  eventType: string,
) {
  const rules = await prisma.automationRule.findMany({
    where: { organizationId, enabled: true, eventType },
  });
  if (rules.length === 0) return { count: 0, runIds: [] as string[] };

  const runs = await prisma.$transaction(
    rules.map((rule) =>
      prisma.automationRun.create({
        data: {
          organizationId,
          ruleId: rule.id,
          learningEventId,
          status: "PENDING",
          metadata: { actionType: rule.actionType },
        },
        select: { id: true },
      }),
    ),
  );

  // Dynamic import to avoid an events <-> dispatcher cycle at module init.
  const { dispatchAutomationRun } = await import(
    "@/lib/automations/dispatcher"
  );
  await Promise.all(
    runs.map(async (run) => {
      try {
        await dispatchAutomationRun(run.id);
      } catch (error) {
        console.error("[automations] dispatch failed", run.id, error);
      }
    }),
  );

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
