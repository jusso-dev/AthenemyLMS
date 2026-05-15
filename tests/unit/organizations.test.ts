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
    organization: { create: vi.fn() },
    organizationInvitation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    organizationMembership: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

describe("organizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockResolvedValue([]);
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
    mocks.prisma.organization.create.mockResolvedValue({});

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
    mocks.prisma.organizationMembership.upsert.mockReturnValue({ membership: true });
    mocks.prisma.organizationInvitation.update.mockReturnValue({ invitation: true });

    await acceptInvitation({
      token: "token",
      userId: "user_1",
      email: "learner@example.com",
    });

    expect(mocks.prisma.$transaction).toHaveBeenCalledWith([
      { membership: true },
      { invitation: true },
    ]);
  });
});
