import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const db = {
    organizationMembership: {
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    enrollment: { updateMany: vi.fn() },
    user: { update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, requireAppUser: vi.fn(), clerkClient: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/lib/auth", () => ({ requireAppUser: mocks.requireAppUser }));
vi.mock("@/lib/env", () => ({ env: {}, missingEnv: () => [] }));
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: mocks.clerkClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import {
  deleteOrganizationMemberAction,
  requirePasswordResetAction,
  updateOrganizationMemberAction,
} from "@/app/dashboard/settings/organization-actions";

function memberForm() {
  const data = new FormData();
  data.set("organizationId", "org_one");
  data.set("membershipId", "member_two");
  data.set("orgRole", "INSTRUCTOR");
  return data;
}

describe("organisation membership administration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAppUser.mockResolvedValue({ id: "actor", role: "STUDENT" });
    mocks.db.$transaction.mockImplementation(async (operation) =>
      operation(mocks.db),
    );
    mocks.db.organizationMembership.findUnique.mockImplementation(
      async ({ where }) =>
        where.organizationId_userId
          ? { role: "OWNER", organizationId: "org_one", userId: "actor" }
          : {
              id: "member_two",
              role: "MEMBER",
              organizationId: "org_one",
              userId: "learner",
              user: { clerkId: "clerk_learner" },
            },
    );
    mocks.db.organizationMembership.count.mockResolvedValue(1);
  });

  it("changes only the organisation role, preserving the shared account", async () => {
    await updateOrganizationMemberAction(memberForm());
    expect(mocks.db.organizationMembership.update).toHaveBeenCalledWith({
      where: { id: "member_two" },
      data: { role: "INSTRUCTOR" },
    });
    expect(mocks.db.user.update).not.toHaveBeenCalled();
    expect(mocks.clerkClient).not.toHaveBeenCalled();
  });

  it("removes membership and cancels only that organisation's enrollments", async () => {
    await deleteOrganizationMemberAction(memberForm());
    expect(mocks.db.organizationMembership.delete).toHaveBeenCalledWith({
      where: { id: "member_two" },
    });
    expect(mocks.db.enrollment.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "learner",
        course: { organizationId: "org_one" },
        status: { not: "CANCELLED" },
      },
      data: { status: "CANCELLED" },
    });
    expect(mocks.db.user.delete).not.toHaveBeenCalled();
    expect(mocks.clerkClient).not.toHaveBeenCalled();
  });

  it("keeps global credential management restricted to platform administrators", async () => {
    await expect(requirePasswordResetAction(memberForm())).rejects.toThrow(
      "Platform administrator",
    );
    expect(mocks.clerkClient).not.toHaveBeenCalled();
  });

  it("preserves the last owner", async () => {
    mocks.db.organizationMembership.findUnique.mockResolvedValue({
      id: "member_two",
      role: "OWNER",
      organizationId: "org_one",
      userId: "learner",
    });
    await expect(updateOrganizationMemberAction(memberForm())).rejects.toThrow(
      "at least one owner",
    );
    await expect(deleteOrganizationMemberAction(memberForm())).rejects.toThrow(
      "at least one owner",
    );
    expect(mocks.db.organizationMembership.update).not.toHaveBeenCalled();
    expect(mocks.db.organizationMembership.delete).not.toHaveBeenCalled();
  });

  it("keeps membership changes within the selected organisation", async () => {
    mocks.db.organizationMembership.findUnique.mockImplementation(
      async ({ where }) =>
        where.organizationId_userId
          ? { role: "OWNER" }
          : { organizationId: "org_two" },
    );
    await expect(updateOrganizationMemberAction(memberForm())).rejects.toThrow(
      "not found",
    );
    expect(mocks.db.organizationMembership.update).not.toHaveBeenCalled();
  });
});
