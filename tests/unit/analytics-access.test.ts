import { beforeEach, describe, expect, it, vi } from "vitest";
import { getInstructorAnalytics } from "@/lib/analytics";
import type { AppUser } from "@/lib/auth";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    course: { findMany: mocks.findMany, count: mocks.count },
    enrollment: { groupBy: mocks.groupBy },
    payment: { groupBy: mocks.groupBy },
  },
}));
vi.mock("@/lib/env", () => ({ missingEnv: () => [] }));

const user: AppUser = {
  id: "user_1",
  clerkId: "clerk_1",
  email: "owner@example.com",
  name: "Owner",
  imageUrl: null,
  role: "STUDENT",
  organizationMemberships: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([]);
  mocks.count.mockResolvedValue(0);
  mocks.groupBy.mockResolvedValue([]);
});

describe("analytics access", () => {
  it("allows an organization owner to inspect only courses they manage", async () => {
    await expect(
      getInstructorAnalytics({
        ...user,
        organizationMemberships: [
          { organizationId: "org_owned", role: "OWNER" },
        ],
      }),
    ).resolves.toMatchObject({ mode: "database" });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              instructorId: "user_1",
              OR: [
                { organizationId: null },
                { organizationId: { in: ["org_owned"] } },
              ],
            },
            { organizationId: { in: ["org_owned"] } },
          ],
        },
      }),
    );
  });

  it("does not let organization instructors inspect colleagues' courses", async () => {
    await getInstructorAnalytics({
      ...user,
      organizationMemberships: [
        { organizationId: "org_teaching", role: "INSTRUCTOR" },
      ],
    });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              instructorId: "user_1",
              OR: [
                { organizationId: null },
                { organizationId: { in: ["org_teaching"] } },
              ],
            },
            { organizationId: { in: [] } },
          ],
        },
      }),
    );
  });

  it("denies analytics to a learner without management capabilities", async () => {
    await expect(getInstructorAnalytics(user)).resolves.toMatchObject({
      mode: "permission",
    });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("propagates a database failure rather than showing missing setup", async () => {
    mocks.findMany.mockRejectedValueOnce(new Error("Database unavailable"));
    await expect(
      getInstructorAnalytics({ ...user, role: "ADMIN" }),
    ).rejects.toThrow("Database unavailable");
  });
});
