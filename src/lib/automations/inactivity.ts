import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordLearningEvent } from "@/lib/automations/events";

/** Once per inactivity episode; paging avoids retaining an organization's enrollments in memory. */
export async function enqueueInactivityEvents(now = new Date()) {
  const rules = await prisma.automationRule.findMany({
    where: {
      enabled: true,
      eventType: "learner.inactive",
      actionType: "email.inactivity_nudge",
    },
  });
  let queued = 0;
  for (const rule of rules) {
    const configured = (rule.config as Prisma.JsonObject | null)?.inactiveDays;
    const days =
      typeof configured === "number" &&
      Number.isInteger(configured) &&
      configured >= 1 &&
      configured <= 365
        ? configured
        : 7;
    const cutoff = new Date(now.getTime() - days * 86_400_000);
    let cursor: string | undefined;
    while (true) {
      const enrollments = await prisma.enrollment.findMany({
        where: {
          status: "ACTIVE",
          createdAt: { lte: cutoff },
          course: { organizationId: rule.organizationId, status: "PUBLISHED" },
        },
        include: {
          user: { select: { email: true, name: true } },
          course: { select: { title: true } },
        },
        orderBy: { id: "asc" },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const enrollment of enrollments) {
        const latest = await prisma.lessonProgress.findFirst({
          where: {
            userId: enrollment.userId,
            lesson: { section: { courseId: enrollment.courseId } },
          },
          orderBy: { lastSeenAt: "desc" },
          select: { lastSeenAt: true },
        });
        const lastActivity = latest?.lastSeenAt ?? enrollment.createdAt;
        if (lastActivity > cutoff) continue;
        await recordLearningEvent({
          organizationId: rule.organizationId,
          userId: enrollment.userId,
          courseId: enrollment.courseId,
          type: "learner.inactive",
          payload: {
            email: enrollment.user.email,
            userName: enrollment.user.name,
            courseTitle: enrollment.course.title,
            ruleId: rule.id,
          },
          idempotencyKey: `inactive:${rule.id}:${enrollment.id}:${lastActivity.toISOString()}`,
        });
        queued += 1;
      }
      if (enrollments.length < 100) break;
      cursor = enrollments[enrollments.length - 1].id;
    }
  }
  return queued;
}
