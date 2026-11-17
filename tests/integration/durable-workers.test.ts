import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
const external = vi.hoisted(() => ({ email: vi.fn(), webhook: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendEnrollmentEmail: external.email,
  sendCourseCompletionEmail: external.email,
  sendCertificateIssuedEmail: external.email,
  sendInactivityNudgeEmail: external.email,
}));
vi.mock("@/lib/developer/webhook-transport", () => ({
  deliverWebhook: external.webhook,
}));
import { prisma } from "@/lib/prisma";
import { recordLearningEvent } from "@/lib/automations/events";
import { enqueueInactivityEvents } from "@/lib/automations/inactivity";
import { fanOutLearningEvent } from "@/lib/automations/worker";
import { processAutomationRun } from "@/lib/automations/dispatcher";
import { encryptWebhookSecret } from "@/lib/developer/webhook-secrets";
import {
  processWebhookDelivery,
  replayWebhookDelivery,
} from "@/lib/developer/webhook-worker";
import { buildWebhookSignatureHeader } from "@/lib/developer/webhooks";
let orgId = "";
let endpointId = "";
const fixtureUsers: string[] = [];
const standaloneEvents: string[] = [];
beforeAll(async () => {
  if (
    !process.env.DATABASE_URL ||
    !new URL(process.env.DATABASE_URL).pathname.endsWith("_verify")
  )
    throw new Error("Disposable _verify database required.");
  vi.stubEnv("WEBHOOK_ENCRYPTION_KEY", Buffer.alloc(32, 8).toString("base64"));
  const org = await prisma.organization.create({
    data: { name: "Worker verification", slug: `workers-${randomUUID()}` },
  });
  orgId = org.id;
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      organizationId: orgId,
      url: "https://receiver.example.test/hook",
      secretHash: "test",
      signingSecretEncrypted: encryptWebhookSecret("whsec_fixture", orgId),
    },
  });
  endpointId = endpoint.id;
  await prisma.automationRule.create({
    data: {
      organizationId: orgId,
      name: "Welcome",
      eventType: "user.enrolled",
      actionType: "email.enrollment_welcome",
      config: {},
    },
  });
});
beforeEach(() => {
  vi.clearAllMocks();
  external.email.mockResolvedValue({ provider: "resend", accepted: true });
  external.webhook.mockResolvedValue(204);
});
afterAll(async () => {
  if (orgId) {
    await prisma.learningEvent.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.delete({ where: { id: orgId } });
  }
  await prisma.learningEvent.deleteMany({
    where: { id: { in: standaloneEvents } },
  });
  await prisma.user.deleteMany({ where: { id: { in: fixtureUsers } } });
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});
async function eventAndRun() {
  const event = await recordLearningEvent({
    organizationId: orgId,
    type: "user.enrolled",
    payload: { email: "learner@example.test", courseTitle: "Test" },
    idempotencyKey: randomUUID(),
  });
  await fanOutLearningEvent(event.id);
  return {
    event,
    run: await prisma.automationRun.findFirstOrThrow({
      where: { learningEventId: event.id },
    }),
  };
}
describe("PostgreSQL durable delivery", () => {
  it("deduplicates organization-less lifecycle events", async () => {
    const key = randomUUID();
    const a = await recordLearningEvent({
      type: "certificate.issued",
      idempotencyKey: key,
    });
    standaloneEvents.push(a.id);
    const b = await recordLearningEvent({
      type: "certificate.issued",
      idempotencyKey: key,
    });
    expect(a.id).toBe(b.id);
  });
  it("queues inactivity once per episode and ignores recent activity", async () => {
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        clerkId: `worker-${suffix}`,
        email: `${suffix}@example.test`,
        name: "Learner",
      },
    });
    fixtureUsers.push(user.id);
    const course = await prisma.course.create({
      data: {
        organizationId: orgId,
        instructorId: user.id,
        title: "Inactivity fixture",
        slug: `worker-${suffix}`,
        status: "PUBLISHED",
        sections: {
          create: {
            title: "Section",
            lessons: { create: { title: "Lesson", slug: "lesson" } },
          },
        },
      },
      include: { sections: { include: { lessons: true } } },
    });
    const rule = await prisma.automationRule.create({
      data: {
        organizationId: orgId,
        name: "Nudge",
        eventType: "learner.inactive",
        actionType: "email.inactivity_nudge",
        config: { inactiveDays: 7 },
      },
    });
    await prisma.enrollment.create({
      data: {
        userId: user.id,
        courseId: course.id,
        createdAt: new Date(Date.now() - 8 * 86_400_000),
      },
    });
    await enqueueInactivityEvents();
    await enqueueInactivityEvents();
    expect(
      await prisma.learningEvent.count({
        where: {
          organizationId: orgId,
          courseId: course.id,
          type: "learner.inactive",
        },
      }),
    ).toBe(1);
    await prisma.lessonProgress.create({
      data: {
        userId: user.id,
        lessonId: course.sections[0].lessons[0].id,
        lastSeenAt: new Date(),
      },
    });
    await enqueueInactivityEvents();
    expect(
      await prisma.learningEvent.count({
        where: {
          organizationId: orgId,
          courseId: course.id,
          type: "learner.inactive",
        },
      }),
    ).toBe(1);
    await prisma.automationRule.delete({ where: { id: rule.id } });
    await prisma.course.delete({ where: { id: course.id } });
  });
  it("commits learning events with business changes and rolls both back on failure", async () => {
    const key = randomUUID();
    await expect(
      prisma.$transaction(async (tx) => {
        await recordLearningEvent(
          {
            organizationId: orgId,
            type: "course.completed",
            idempotencyKey: key,
          },
          tx,
        );
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(
      await prisma.learningEvent.count({
        where: { organizationId: orgId, idempotencyKey: key },
      }),
    ).toBe(0);
  });
  it("deduplicates concurrent event fanout into exactly one run and delivery", async () => {
    const key = randomUUID();
    const [a, b] = await Promise.all(
      [1, 2].map(() =>
        recordLearningEvent({
          organizationId: orgId,
          type: "user.enrolled",
          idempotencyKey: key,
        }),
      ),
    );
    expect(a.id).toBe(b.id);
    await Promise.all([fanOutLearningEvent(a.id), fanOutLearningEvent(a.id)]);
    expect(
      await prisma.automationRun.count({ where: { learningEventId: a.id } }),
    ).toBe(1);
    expect(
      await prisma.webhookDelivery.count({
        where: { endpointId, eventKey: a.id },
      }),
    ).toBe(1);
  });
  it("allows only one racing worker to send and recovers an expired lease", async () => {
    const { run } = await eventAndRun();
    await Promise.all([
      processAutomationRun(run.id),
      processAutomationRun(run.id),
    ]);
    expect(external.email).toHaveBeenCalledTimes(1);
    expect(
      await prisma.notificationDelivery.count({
        where: { automationRunId: run.id },
      }),
    ).toBe(1);
    const second = await eventAndRun();
    await prisma.automationRun.update({
      where: { id: second.run.id },
      data: {
        status: "RUNNING",
        attempts: 1,
        leaseToken: "dead-worker",
        leaseExpiresAt: new Date(0),
      },
    });
    expect(await processAutomationRun(second.run.id)).toMatchObject({
      status: "SUCCEEDED",
    });
    expect(external.email).toHaveBeenLastCalledWith(
      expect.objectContaining({
        idempotencyKey: `automation:${second.run.id}`,
      }),
    );
  });
  it("persists backoff, respects not-yet-due work, and succeeds on retry", async () => {
    const { run } = await eventAndRun();
    external.email.mockRejectedValueOnce(new Error("provider down"));
    expect(await processAutomationRun(run.id)).toMatchObject({
      status: "PENDING",
    });
    const failed = await prisma.automationRun.findUniqueOrThrow({
      where: { id: run.id },
    });
    expect(failed.nextRetryAt!.getTime()).toBeGreaterThan(Date.now());
    await processAutomationRun(run.id);
    expect(external.email).toHaveBeenCalledTimes(1);
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { nextRetryAt: new Date(0) },
    });
    expect(await processAutomationRun(run.id)).toMatchObject({
      status: "SUCCEEDED",
    });
    expect(
      await prisma.notificationDelivery.count({
        where: { automationRunId: run.id },
      }),
    ).toBe(1);
  });
  it("signs webhooks, records attempts, backs off and permits only scoped failed replay", async () => {
    const { event } = await eventAndRun();
    const delivery = await prisma.webhookDelivery.findFirstOrThrow({
      where: { endpointId, eventKey: event.id },
    });
    external.webhook.mockResolvedValueOnce(503);
    await Promise.all([
      processWebhookDelivery(delivery.id),
      processWebhookDelivery(delivery.id),
    ]);
    expect(external.webhook).toHaveBeenCalledTimes(1);
    const [url, body, signature, id] = external.webhook.mock.calls[0];
    expect(url).toBe("https://receiver.example.test/hook");
    expect(id).toBe(delivery.id);
    const timestamp = Number(String(signature).match(/^t=(\d+),/)![1]);
    expect(signature).toBe(
      buildWebhookSignatureHeader({ secret: "whsec_fixture", timestamp, body }),
    );
    expect(
      await prisma.webhookDeliveryAttempt.count({
        where: { deliveryId: delivery.id },
      }),
    ).toBe(1);
    expect(
      await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } }),
    ).toMatchObject({ status: "RETRYING", attempts: 1 });
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { nextRetryAt: new Date(0) },
    });
    external.webhook.mockResolvedValueOnce(400);
    await processWebhookDelivery(delivery.id);
    await expect(
      replayWebhookDelivery("other-org", delivery.id),
    ).rejects.toThrow("not found");
    const replay = await replayWebhookDelivery(orgId, delivery.id);
    expect(replay.payload).toEqual(delivery.payload);
    expect((await replayWebhookDelivery(orgId, delivery.id)).id).toBe(
      replay.id,
    );
    await processWebhookDelivery(replay.id);
    expect(
      await prisma.webhookDelivery.findUnique({ where: { id: replay.id } }),
    ).toMatchObject({ status: "DELIVERED" });
  });
});
