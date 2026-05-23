import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptInvitation,
  canManageOrganization,
  createInvitationToken,
  createOrganizationForUser,
  hasOrgRole,
} from "@/lib/organizations";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { update: vi.fn() },
    organization: { create: vi.fn() },
    organizationInvitation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    organizationMembership: {
      upsert: vi.fn(),
    },
    course: { findMany: vi.fn() },
    enrollment: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
  templates: {
    instantiateDefaultCourseTemplate: vi.fn(),
    autoEnrollFutureMember: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/course-templates", () => ({
  instantiateDefaultCourseTemplate:
    mocks.templates.instantiateDefaultCourseTemplate,
  autoEnrollFutureMember: mocks.templates.autoEnrollFutureMember,
}));

describe("organizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockResolvedValue([]);
    mocks.prisma.course.findMany.mockResolvedValue([]);
    mocks.prisma.enrollment.createMany.mockResolvedValue({ count: 0 });
    mocks.templates.instantiateDefaultCourseTemplate.mockResolvedValue({
      id: "course_starter",
    });
    mocks.templates.autoEnrollFutureMember.mockResolvedValue({ count: 0 });
  });

  it("creates stable invitation tokens", () => {
    expect(createInvitationToken("12345678-90ab-cdef-1234-567890abcdef")).toBe(
      "1234567890abcdef1234567890abcdef",
    );
  });

  it("checks organisation role hierarchy", () => {
    expect(hasOrgRole("OWNER", "ADMIN")).toBe(true);
    expect(hasOrgRole("MEMBER", "INSTRUCTOR")).toBe(false);
    expect(
      canManageOrganization(
        { id: "user_1", role: "STUDENT" },
        { role: "ADMIN" },
      ),
    ).toBe(true);
  });

  it("creates an organisation with owner membership", async () => {
    mocks.prisma.user.update.mockReturnValue({ user: true });
    mocks.prisma.organization.create.mockReturnValue({ organization: true });
    mocks.prisma.$transaction.mockResolvedValue([
      { user: true },
      { organization: true },
    ]);

    await createOrganizationForUser({
      name: "Athenemy Studio",
      supportEmail: "support@example.com",
      userId: "user_1",
    });

    expect(mocks.prisma.organization.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Athenemy Studio",
        supportEmail: "support@example.com",
        memberships: { create: { userId: "user_1", role: "OWNER" } },
      }),
    });
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { role: "ADMIN" },
    });
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith([
      { user: true },
      { organization: true },
    ]);
  });

  it("instantiates starter templates passed in during onboarding", async () => {
    mocks.prisma.$transaction.mockResolvedValue([
      { user: true },
      { id: "org_new" },
    ]);

    await createOrganizationForUser({
      name: "Athenemy Studio",
      userId: "user_1",
      starterTemplateIds: ["cyber-security-awareness", "phishing-awareness"],
    });

    expect(
      mocks.templates.instantiateDefaultCourseTemplate,
    ).toHaveBeenCalledTimes(2);
    expect(
      mocks.templates.instantiateDefaultCourseTemplate,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_new",
        instructorId: "user_1",
        templateId: "cyber-security-awareness",
        required: true,
        autoEnrollExisting: true,
        autoEnrollFuture: true,
      }),
    );
  });

  it("accepts pending invitations for matching users", async () => {
    const expiresAt = new Date(Date.now() + 1000 * 60);
    mocks.prisma.organizationInvitation.findUnique.mockResolvedValue({
      id: "invite_1",
      organizationId: "org_1",
      email: "learner@example.com",
      role: "INSTRUCTOR",
      status: "PENDING",
      expiresAt,
    });
    mocks.prisma.organizationMembership.upsert.mockReturnValue({
      membership: true,
    });
    mocks.prisma.organizationInvitation.update.mockReturnValue({
      invitation: true,
    });

    await acceptInvitation({
      token: "token",
      userId: "user_1",
      email: "learner@example.com",
    });

    expect(mocks.prisma.$transaction).toHaveBeenCalledWith([
      { membership: true },
      { invitation: true },
    ]);
    expect(mocks.templates.autoEnrollFutureMember).toHaveBeenCalledWith({
      organizationId: "org_1",
      userId: "user_1",
    });
  });
});
