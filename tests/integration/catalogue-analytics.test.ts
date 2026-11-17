import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getPublishedCourseCatalogue } from "@/lib/course-data";
import { getPortalCourseCatalogue } from "@/lib/portal";
import { formatRevenueTotals, getInstructorAnalytics } from "@/lib/analytics";
import type { AppUser } from "@/lib/auth";
const token = randomUUID();
const title = `Catalogue verification ${token}`;
const courseIds: string[] = [],
  userIds: string[] = [],
  organizationIds: string[] = [];
let actor: AppUser, learnerId: string, organizationId: string;
let databaseVerified = false;
beforeAll(async () => {
  if (
    !process.env.DATABASE_URL ||
    !new URL(process.env.DATABASE_URL).pathname.endsWith("_verify")
  )
    throw new Error("Scale tests require a disposable _verify database.");
  databaseVerified = true;
  const teacher = await prisma.user.create({
    data: {
      clerkId: `scale-teacher-${token}`,
      email: `teacher-${token}@example.test`,
      role: "INSTRUCTOR",
    },
  });
  userIds.push(teacher.id);
  const learner = await prisma.user.create({
    data: {
      clerkId: `scale-learner-${token}`,
      email: `learner-${token}@example.test`,
    },
  });
  userIds.push(learner.id);
  learnerId = learner.id;
  const organization = await prisma.organization.create({
    data: { name: "Scale verification", slug: `scale-${token}` },
  });
  organizationId = organization.id;
  organizationIds.push(organization.id);
  const foreign = await prisma.organization.create({
    data: { name: "Other tenant", slug: `other-scale-${token}` },
  });
  organizationIds.push(foreign.id);
  actor = {
    ...teacher,
    organizationMemberships: [{ organizationId, role: "INSTRUCTOR" }],
  };
  const rows = Array.from({ length: 58 }, (_, index) => ({
    id: `scale-${token}-${String(index).padStart(3, "0")}`,
    slug: `scale-${token}-${index}`,
    title: index === 57 ? "Other tenant course" : `${title} ${index}`,
    instructorId: teacher.id,
    organizationId: index === 57 ? foreign.id : organizationId,
    status:
      index === 55
        ? ("DRAFT" as const)
        : index === 56
          ? ("ARCHIVED" as const)
          : ("PUBLISHED" as const),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  }));
  await prisma.course.createMany({ data: rows });
  courseIds.push(...rows.map((row) => row.id));
  await prisma.enrollment.createMany({
    data: courseIds
      .slice(0, 57)
      .map((courseId, index) => ({
        courseId,
        userId: learnerId,
        status: index < 10 ? ("COMPLETED" as const) : ("ACTIVE" as const),
      })),
  });
  await prisma.payment.createMany({
    data: [
      {
        userId: learnerId,
        courseId: courseIds[0],
        amountCents: 10000,
        refundedAmountCents: 2500,
        currency: "usd",
        status: "PAID",
      },
      {
        userId: learnerId,
        courseId: courseIds[0],
        amountCents: 12000,
        refundedAmountCents: 2000,
        currency: "aud",
        status: "PAID",
      },
      {
        userId: learnerId,
        courseId: courseIds[0],
        amountCents: 10000,
        refundedAmountCents: 10000,
        currency: "usd",
        status: "REFUNDED",
      },
      {
        userId: learnerId,
        courseId: courseIds[0],
        amountCents: 99999,
        currency: "usd",
        status: "DISPUTED",
      },
      {
        userId: learnerId,
        courseId: courseIds[56],
        amountCents: 2500,
        currency: "usd",
        status: "PAID",
      },
    ],
  });
  const section = await prisma.courseSection.create({
    data: {
      title: "Scale lessons",
      courseId: courseIds[56],
      lessons: {
        create: [
          { title: "One", slug: "one" },
          { title: "Two", slug: "two" },
        ],
      },
    },
    include: { lessons: true },
  });
  await prisma.lessonProgress.createMany({
    data: section.lessons.map((lesson) => ({
      lessonId: lesson.id,
      userId: learnerId,
      completedAt: new Date(),
    })),
  });
});
afterAll(async () => {
  if (!databaseVerified) return;
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
  await prisma.organization.deleteMany({
    where: { id: { in: organizationIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});
describe("bounded catalogue and analytics queries", () => {
  it("searches and pages all published matches without duplicate or missing results", async () => {
    const pages = await Promise.all(
      [1, 2, 3].map((page) => getPublishedCourseCatalogue(title, page)),
    );
    expect(pages.map((page) => page.courses.length)).toEqual([24, 24, 7]);
    expect(pages.map((page) => page.total)).toEqual([55, 55, 55]);
    expect(
      new Set(pages.flatMap((page) => page.courses.map((course) => course.id)))
        .size,
    ).toBe(55);
    expect(
      (await getPublishedCourseCatalogue(title, Number.MAX_SAFE_INTEGER)).page,
    ).toBe(3);
    expect((await getPublishedCourseCatalogue(title, "invalid")).page).toBe(1);
  });
  it("applies tenant scope and search on every portal page", async () => {
    const result = await getPortalCourseCatalogue(organizationId, undefined, 3);
    expect(result.total).toBe(55);
    expect(result.courses).toHaveLength(7);
    expect(
      result.courses.every((course) => course.title.startsWith(title)),
    ).toBe(true);
    expect(
      (await getPortalCourseCatalogue(organizationId, "Other tenant")).total,
    ).toBe(0);
  });
  it("keeps full-scope totals while bounding detail and separating net currency amounts", async () => {
    const first = await getInstructorAnalytics(actor, 1),
      last = await getInstructorAnalytics(actor, 3);
    expect(first.total).toBe(57);
    expect(first.courses).toHaveLength(24);
    expect(last.courses).toHaveLength(9);
    expect(first.stats).toEqual(last.stats);
    expect(first.stats).toContainEqual({
      label: "Published courses",
      value: "55",
    });
    expect(first.stats).toContainEqual({
      label: "Active enrollments",
      value: "47",
    });
    expect(first.stats).toContainEqual({
      label: "Completion rate",
      value: "18%",
    });
    expect(first.stats).toContainEqual({
      label: "Lifetime revenue",
      value: formatRevenueTotals([
        { currency: "usd", revenueCents: 10000 },
        { currency: "aud", revenueCents: 10000 },
      ]),
    });
    expect(first.courses[0].revenueByCurrency).toEqual(
      expect.arrayContaining([
        { currency: "usd", revenueCents: 7500 },
        { currency: "aud", revenueCents: 10000 },
      ]),
    );
    expect(first.courses[0].revenueCents).toBe(0);
    expect(
      last.courses.find((course) => course.id === courseIds[56])
        ?.lessonCompletions,
    ).toBe(2);
    expect(
      [...first.courses, ...last.courses].every(
        (course) => course.id !== courseIds[57],
      ),
    ).toBe(true);
  });
});
