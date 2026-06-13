import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  builtInAutomationRecipes,
  evaluateAutomationRules,
  recordLearningEvent,
} from "@/lib/automations/events";
import { processAutomationRun } from "@/lib/automations/dispatcher";

const mocks = vi.hoisted(() => ({
  prisma: {
    learningEvent: { upsert: vi.fn() },
    automationRule: { findMany: vi.fn() },
    automationRun: {
      create: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    notificationDelivery: {
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  email: {
    sendEnrollmentEmail: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/email", () => ({
  sendEnrollmentEmail: mocks.email.sendEnrollmentEmail,
}));

describe("automations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.learningEvent.upsert.mockResolvedValue({
      id: "event_1",
      organizationId: "org_1",
      type: "user.enrolled",
    });
    mocks.prisma.automationRule.findMany.mockResolvedValue([
      { id: "rule_1", actionType: "email.enrollment_welcome" },
    ]);
    mocks.prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
    mocks.prisma.$transaction.mockImplementation(async (operations: unknown) =>
      Array.isArray(operations) ? Promise.all(operations) : operations,
    );
    mocks.prisma.automationRun.update.mockResolvedValue({});
    mocks.prisma.notificationDelivery.create.mockResolvedValue({ id: "delivery_1" });
    mocks.prisma.notificationDelivery.update.mockResolvedValue({});
    mocks.email.sendEnrollmentEmail.mockResolvedValue({
      provider: "stub",
      event: "enrollment",
      accepted: true,
    });
  });

  it("ships lifecycle recipe defaults", () => {
    expect(
      builtInAutomationRecipes.map((recipe) => recipe.eventType),
    ).toContain("certificate.issued");
  });

  it("records idempotent learning events and dispatches matching rules", async () => {
    mocks.prisma.automationRun.findUnique.mockResolvedValueOnce({
      id: "run_1",
      organizationId: "org_1",
      status: "PENDING",
      metadata: {},
      rule: { actionType: "email.enrollment_welcome" },
      learningEvent: {
        payload: {
          email: "learner@example.com",
          courseTitle: "Security",
        },
      },
    });

    await recordLearningEvent({
      organizationId: "org_1",
      userId: "user_1",
      courseId: "course_1",
      type: "user.enrolled",
      payload: { courseTitle: "Security", email: "learner@example.com" },
      idempotencyKey: "enrollment:user_1:course_1",
    });

    expect(mocks.prisma.learningEvent.upsert).toHaveBeenCalledWith({
      where: {
        organizationId_idempotencyKey: {
          organizationId: "org_1",
          idempotencyKey: "enrollment:user_1:course_1",
        },
      },
      update: {},
      create: expect.objectContaining({
        organizationId: "org_1",
        type: "user.enrolled",
      }),
    });
    expect(mocks.prisma.automationRun.create).toHaveBeenCalled();
    expect(mocks.email.sendEnrollmentEmail).toHaveBeenCalledWith({
      to: "learner@example.com",
      name: undefined,
      courseTitle: "Security",
    });
  });

  it("returns run ids from evaluateAutomationRules", async () => {
    mocks.prisma.automationRun.findUnique.mockResolvedValue({
      id: "run_1",
      organizationId: "org_1",
      status: "SUCCEEDED",
      metadata: {},
      rule: { actionType: "email.enrollment_welcome" },
      learningEvent: { payload: {} },
    });

    const result = await evaluateAutomationRules(
      "org_1",
      "event_1",
      "user.enrolled",
    );
    expect(result.count).toBe(1);
    expect(result.runIds).toEqual(["run_1"]);
  });

  it("does not throw when dispatch fails inside recordLearningEvent", async () => {
    mocks.prisma.automationRun.create.mockRejectedValueOnce(
      new Error("db unavailable"),
    );
    const event = await recordLearningEvent({
      organizationId: "org_1",
      type: "user.enrolled",
    });
    expect(event).toEqual(
      expect.objectContaining({ id: "event_1", organizationId: "org_1" }),
    );
  });

  it("advances PENDING runs to SUCCEEDED for enrollment welcome", async () => {
    mocks.prisma.automationRun.findUnique.mockResolvedValueOnce({
      id: "run_1",
      organizationId: "org_1",
      status: "PENDING",
      metadata: {},
      rule: { actionType: "email.enrollment_welcome" },
      learningEvent: {
        payload: { email: "learner@example.com", courseTitle: "Security" },
      },
    });

    const outcome = await processAutomationRun("run_1");

    expect(outcome.status).toBe("SUCCEEDED");
    expect(mocks.prisma.automationRun.update).toHaveBeenCalledWith({
      where: { id: "run_1" },
      data: { status: "RUNNING" },
    });
    expect(mocks.prisma.notificationDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: "email",
        recipient: "learner@example.com",
        template: "enrollment_welcome",
        status: "PENDING",
      }),
    });
    expect(mocks.prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: "delivery_1" },
      data: { status: "SENT", sentAt: expect.any(Date) },
    });
  });

  it("skips runs that are already SUCCEEDED", async () => {
    mocks.prisma.automationRun.findUnique.mockResolvedValueOnce({
      id: "run_done",
      status: "SUCCEEDED",
      metadata: {},
      rule: { actionType: "email.enrollment_welcome" },
      learningEvent: { payload: {} },
    });

    const outcome = await processAutomationRun("run_done");
    expect(outcome).toEqual({ status: "SUCCEEDED" });
    expect(mocks.prisma.automationRun.update).not.toHaveBeenCalled();
    expect(mocks.email.sendEnrollmentEmail).not.toHaveBeenCalled();
  });

  it("marks runs FAILED when the action raises", async () => {
    mocks.prisma.automationRun.findUnique.mockResolvedValueOnce({
      id: "run_fail",
      organizationId: "org_1",
      status: "PENDING",
      metadata: {},
      rule: { actionType: "email.enrollment_welcome" },
      learningEvent: {
        payload: { email: "learner@example.com" },
      },
    });
    mocks.email.sendEnrollmentEmail.mockRejectedValueOnce(
      new Error("smtp down"),
    );

    const outcome = await processAutomationRun("run_fail");
    expect(outcome).toEqual({ status: "FAILED", error: "smtp down" });
    expect(mocks.prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: "delivery_1" },
      data: { status: "FAILED", error: "smtp down" },
    });
  });

  it("records a deferred delivery for recipes whose handler is Phase 2", async () => {
    mocks.prisma.automationRun.findUnique.mockResolvedValueOnce({
      id: "run_deferred",
      organizationId: "org_1",
      status: "PENDING",
      metadata: {},
      rule: { actionType: "email.certificate_issued" },
      learningEvent: { payload: { email: "learner@example.com" } },
    });

    const outcome = await processAutomationRun("run_deferred");
    expect(outcome.status).toBe("SKIPPED");
    expect(mocks.prisma.notificationDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        template: "email.certificate_issued",
        status: "PENDING",
      }),
    });
  });
});
