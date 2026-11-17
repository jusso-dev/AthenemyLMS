import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  prisma: {
    learningEvent: { upsert: vi.fn() },
    automationRule: { findMany: vi.fn() },
    automationRun: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    notificationDelivery: {
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  send: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/email", () => ({
  sendEnrollmentEmail: mocks.send,
  sendCourseCompletionEmail: mocks.send,
  sendCertificateIssuedEmail: mocks.send,
  sendInactivityNudgeEmail: mocks.send,
}));
import {
  builtInAutomationRecipes,
  evaluateAutomationRules,
  recordLearningEvent,
} from "@/lib/automations/events";
import {
  automationExecutionMode,
  processAutomationRun,
  retryAt,
} from "@/lib/automations/dispatcher";

function run(actionType = "email.enrollment_welcome", attempts = 1) {
  return {
    id: "run_1",
    organizationId: "org_1",
    attempts,
    rule: { actionType, enabled: true },
    learningEvent: {
      payload: { email: "learner@example.com", courseTitle: "Security" },
    },
  };
}
describe("durable automations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.prisma.automationRun.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.automationRun.findUniqueOrThrow.mockResolvedValue(run());
    mocks.prisma.notificationDelivery.upsert.mockResolvedValue({
      id: "delivery_1",
      status: "PENDING",
    });
    mocks.prisma.notificationDelivery.updateMany.mockResolvedValue({
      count: 1,
    });
    mocks.send.mockResolvedValue({ provider: "resend", accepted: true });
  });
  it("records only a durable event without sending inside the request", async () => {
    await recordLearningEvent({
      organizationId: "org_1",
      type: "user.enrolled",
      idempotencyKey: "enroll_1",
    });
    expect(mocks.prisma.learningEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_idempotencyKey: {
            organizationId: "org_1",
            idempotencyKey: "enroll_1",
          },
        },
      }),
    );
    expect(mocks.prisma.automationRun.createMany).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("deduplicates rule/event fanout", async () => {
    mocks.prisma.automationRule.findMany.mockResolvedValue([
      { id: "rule_1", actionType: "email.enrollment_welcome" },
    ]);
    mocks.prisma.automationRun.findMany.mockResolvedValue([{ id: "run_1" }]);
    expect(
      await evaluateAutomationRules("org_1", "event_1", "user.enrolled"),
    ).toEqual({ count: 1, runIds: ["run_1"] });
    expect(mocks.prisma.automationRun.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });
  it.each(builtInAutomationRecipes)(
    "delivers $name with stable provider idempotency",
    async (recipe) => {
      mocks.prisma.automationRun.findUniqueOrThrow.mockResolvedValue(
        run(recipe.actionType),
      );
      expect(await processAutomationRun("run_1")).toEqual({
        status: "SUCCEEDED",
      });
      expect(mocks.send).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "automation:run_1",
          to: "learner@example.com",
        }),
      );
      expect(mocks.prisma.automationRun.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: "run_1", leaseToken: expect.any(String) },
          data: expect.objectContaining({
            status: "SUCCEEDED",
            leaseToken: null,
          }),
        }),
      );
    },
  );
  it("does not deliver when another worker owns the claim", async () => {
    mocks.prisma.automationRun.updateMany.mockResolvedValue({ count: 0 });
    mocks.prisma.automationRun.findUnique.mockResolvedValue({
      status: "RUNNING",
    });
    expect(await processAutomationRun("run_1")).toEqual({ status: "RUNNING" });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("retries failures with a bounded schedule and redacted diagnostic", async () => {
    mocks.send.mockRejectedValue(new Error("private provider response"));
    expect(await processAutomationRun("run_1")).toMatchObject({
      status: "PENDING",
    });
    expect(mocks.prisma.automationRun.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nextRetryAt: expect.any(Date),
          error: expect.not.stringContaining("private"),
        }),
      }),
    );
    mocks.prisma.automationRun.findUniqueOrThrow.mockResolvedValue(
      run(undefined, 5),
    );
    expect(await processAutomationRun("run_1")).toMatchObject({
      status: "FAILED",
    });
  });
  it("does not resend an already accepted notification after a crash", async () => {
    mocks.prisma.notificationDelivery.upsert.mockResolvedValue({
      id: "delivery_1",
      status: "SENT",
    });
    expect(await processAutomationRun("run_1")).toEqual({
      status: "SUCCEEDED",
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("records stub delivery honestly", async () => {
    mocks.send.mockResolvedValue({ provider: "stub", accepted: true });
    expect(await processAutomationRun("run_1")).toMatchObject({
      status: "SKIPPED",
    });
    expect(
      mocks.prisma.notificationDelivery.updateMany,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SKIPPED", sentAt: null }),
      }),
    );
  });
  it("reports the actual worker and exponential retry delay", () => {
    expect(automationExecutionMode()).toBe("database-worker");
    expect(retryAt(1, new Date(0)).getTime()).toBe(30_000);
    expect(retryAt(3, new Date(0)).getTime()).toBe(120_000);
  });
});
