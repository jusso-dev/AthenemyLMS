import type { Prisma } from "@prisma/client";
import { recordLearningEvent } from "@/lib/automations/events";

/** Look up delivery fields inside the same transaction as the learning mutation. */
export async function recordCourseEvent(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    courseId: string;
    type: string;
    idempotencyKey: string;
    payload?: Record<string, unknown>;
  },
) {
  const [course, user] = await Promise.all([
    tx.course.findUniqueOrThrow({
      where: { id: input.courseId },
      select: { title: true, organizationId: true },
    }),
    tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { email: true, name: true },
    }),
  ]);
  return recordLearningEvent(
    {
      ...input,
      organizationId: course.organizationId,
      payload: {
        email: user.email,
        userName: user.name,
        courseTitle: course.title,
        ...input.payload,
      },
    },
    tx,
  );
}
