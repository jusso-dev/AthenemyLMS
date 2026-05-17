import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  autoEnrollFutureMember,
  defaultCourseTemplates,
  instantiateDefaultCourseTemplate,
} from "@/lib/course-templates";

const mocks = vi.hoisted(() => ({
  prisma: {
    courseTemplate: { upsert: vi.fn() },
    course: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    organizationMembership: { findMany: vi.fn() },
    enrollment: { createMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

describe("default course templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.course.count.mockResolvedValue(0);
    mocks.prisma.courseTemplate.upsert.mockResolvedValue({});
    mocks.prisma.course.create.mockResolvedValue({ id: "course_1" });
    mocks.prisma.organizationMembership.findMany.mockResolvedValue([
      { userId: "user_1" },
    ]);
    mocks.prisma.enrollment.createMany.mockResolvedValue({ count: 1 });
  });

  it("ships practical editable starter templates", () => {
    expect(defaultCourseTemplates.length).toBeGreaterThanOrEqual(5);
    expect(defaultCourseTemplates.map((template) => template.id)).toContain(
      "cyber-security-awareness",
    );
    expect(defaultCourseTemplates[0].assessment.length).toBeGreaterThan(0);
  });

  it("instantiates an editable organization course copy", async () => {
    await instantiateDefaultCourseTemplate({
      organizationId: "org_1",
      instructorId: "user_1",
      templateId: "cyber-security-awareness",
      required: true,
      autoEnrollExisting: true,
      autoEnrollFuture: true,
    });

    expect(mocks.prisma.courseTemplate.upsert).toHaveBeenCalled();
    expect(mocks.prisma.course.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org_1",
        instructorId: "user_1",
        sourceTemplateId: "cyber-security-awareness",
        sourceTemplateVersion: 1,
        requiredForMembers: true,
        autoEnrollFutureMembers: true,
      }),
    });
    expect(mocks.prisma.enrollment.createMany).toHaveBeenCalledWith({
      data: [{ userId: "user_1", courseId: "course_1", status: "ACTIVE" }],
      skipDuplicates: true,
    });
  });

  it("auto-enrolls future members only into active enabled courses", async () => {
    mocks.prisma.course.findMany.mockResolvedValue([{ id: "course_1" }]);

    await autoEnrollFutureMember({ organizationId: "org_1", userId: "user_2" });

    expect(mocks.prisma.course.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        status: { not: "ARCHIVED" },
        autoEnrollFutureMembers: true,
      },
      select: { id: true },
    });
    expect(mocks.prisma.enrollment.createMany).toHaveBeenCalledWith({
      data: [{ userId: "user_2", courseId: "course_1", status: "ACTIVE" }],
      skipDuplicates: true,
    });
  });
});
