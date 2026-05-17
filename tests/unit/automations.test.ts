import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  builtInAutomationRecipes,
  evaluateAutomationRules,
  recordLearningEvent,
} from "@/lib/automations/events";

const mocks = vi.hoisted(() => ({
  prisma: {
    learningEvent: { upsert: vi.fn() },
    automationRule: { findMany: vi.fn() },
    automationRun: { createMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

describe("automations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.learningEvent.upsert.mockResolvedValue({
      id: "event_1",
      organizationId: "org_1",
      type: "user.enrolled",
    });
    mocks.prisma.automationRule.findMany.mockResolvedValue([
      {
        id: "rule_1",
        actionType: "email.enrollment_welcome",
      },
    ]);
    mocks.prisma.automationRun.createMany.mockResolvedValue({ count: 1 });
  });

  it("ships lifecycle recipe defaults", () => {
    expect(
      builtInAutomationRecipes.map((recipe) => recipe.eventType),
    ).toContain("certificate.issued");
  });

  it("records idempotent learning events and queues matching rules", async () => {
    await recordLearningEvent({
      organizationId: "org_1",
      userId: "user_1",
      courseId: "course_1",
      type: "user.enrolled",
      payload: { courseTitle: "Security" },
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
    expect(mocks.prisma.automationRun.createMany).toHaveBeenCalled();
  });

  it("creates one automation run per matching enabled rule", async () => {
    await evaluateAutomationRules("org_1", "event_1", "user.enrolled");

    expect(mocks.prisma.automationRule.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        enabled: true,
        eventType: "user.enrolled",
      },
    });
    expect(mocks.prisma.automationRun.createMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: "org_1",
          ruleId: "rule_1",
          learningEventId: "event_1",
          status: "PENDING",
          metadata: { actionType: "email.enrollment_welcome" },
        },
      ],
    });
  });
});
