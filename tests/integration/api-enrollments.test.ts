import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const identity = vi.hoisted(() => ({ organizationId: "" }));
vi.mock("@/lib/developer/api-keys", () => ({
  authenticateApiRequest: async () => ({
    organizationId: identity.organizationId,
  }),
  requireApiScope: (context: unknown) => context,
}));
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/v1/enrollments/route";
let memberId = "";
let outsideId = "";
let courseId = "";
beforeAll(async () => {
  if (
    !process.env.DATABASE_URL ||
    !new URL(process.env.DATABASE_URL).pathname.endsWith("_verify")
  )
    throw new Error("Disposable _verify database required.");
  const suffix = randomUUID();
  const org = await prisma.organization.create({
    data: { name: "API verification", slug: `api-${suffix}` },
  });
  identity.organizationId = org.id;
  const member = await prisma.user.create({
    data: {
      clerkId: `api-member-${suffix}`,
      email: `member-${suffix}@example.test`,
      organizationMemberships: {
        create: { organizationId: org.id, role: "MEMBER" },
      },
    },
  });
  memberId = member.id;
  const outside = await prisma.user.create({
    data: {
      clerkId: `api-outsider-${suffix}`,
      email: `outside-${suffix}@example.test`,
    },
  });
  outsideId = outside.id;
  const course = await prisma.course.create({
    data: {
      title: "API course",
      slug: `api-${suffix}`,
      organizationId: org.id,
      instructorId: member.id,
    },
  });
  courseId = course.id;
});
afterAll(async () => {
  if (courseId) await prisma.course.delete({ where: { id: courseId } });
  if (identity.organizationId) {
    await prisma.learningEvent.deleteMany({
      where: { organizationId: identity.organizationId },
    });
    await prisma.organization.delete({
      where: { id: identity.organizationId },
    });
  }
  await prisma.user.deleteMany({
    where: { id: { in: [memberId, outsideId].filter(Boolean) } },
  });
  await prisma.$disconnect();
});
function post(userId: string, selectedCourseId = courseId) {
  return POST(
    new Request("http://localhost/api/v1/enrollments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, courseId: selectedCourseId }),
    }),
  );
}
describe("organization API enrollments", () => {
  it("rejects identities outside the key's organization and unknown courses", async () => {
    expect((await post(outsideId)).status).toBe(404);
    expect((await post(memberId, "unrelated-course")).status).toBe(404);
    expect(await prisma.enrollment.count({ where: { courseId } })).toBe(0);
  });
  it("atomically records recipient-rich enrollment events and preserves completed enrollments", async () => {
    expect((await post(memberId)).status).toBe(201);
    const event = await prisma.learningEvent.findFirstOrThrow({
      where: { organizationId: identity.organizationId, type: "user.enrolled" },
    });
    expect(event.payload).toMatchObject({
      courseTitle: "API course",
      email: expect.stringContaining("@example.test"),
    });
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: memberId, courseId } },
      data: { status: "COMPLETED" },
    });
    expect((await post(memberId)).status).toBe(201);
    expect(
      await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: memberId, courseId } },
      }),
    ).toMatchObject({ status: "COMPLETED" });
    expect(
      await prisma.learningEvent.count({
        where: {
          organizationId: identity.organizationId,
          type: "user.enrolled",
        },
      }),
    ).toBe(1);
  });
});
