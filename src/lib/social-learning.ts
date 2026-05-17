import { prisma } from "@/lib/prisma";
import { canManageCourse } from "@/lib/permissions";
import type { AppUser } from "@/lib/auth";

export async function createCohort(input: {
  actor: AppUser;
  courseId: string;
  name: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  capacity?: number | null;
}) {
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
  });
  if (!course || !canManageCourse(input.actor, course)) {
    throw new Error("Instructor or admin access is required.");
  }
  if (!course.organizationId) {
    throw new Error("Cohorts require an organization-owned course.");
  }

  return prisma.cohort.create({
    data: {
      organizationId: course.organizationId,
      courseId: course.id,
      name: input.name,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      capacity: input.capacity ?? null,
      status: "ACTIVE",
    },
  });
}

export async function createDiscussionThread(input: {
  actor: AppUser;
  courseId: string;
  lessonId?: string | null;
  title: string;
  body: string;
}) {
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: input.actor.id,
        courseId: input.courseId,
      },
    },
    include: { course: true },
  });
  const course =
    enrollment?.course ??
    (await prisma.course.findUnique({ where: { id: input.courseId } }));
  if (!course?.organizationId) throw new Error("Course not found.");
  if (!enrollment && !canManageCourse(input.actor, course)) {
    throw new Error("Enrollment is required to post in this discussion.");
  }

  return prisma.discussionThread.create({
    data: {
      organizationId: course.organizationId,
      courseId: input.courseId,
      lessonId: input.lessonId ?? null,
      title: input.title,
      posts: {
        create: {
          authorId: input.actor.id,
          body: input.body,
        },
      },
    },
    include: { posts: true },
  });
}

export async function scheduleLiveSession(input: {
  actor: AppUser;
  courseId: string;
  title: string;
  providerUrl: string;
  startsAt: Date;
  durationMinutes?: number;
}) {
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
  });
  if (!course || !canManageCourse(input.actor, course)) {
    throw new Error("Instructor or admin access is required.");
  }
  if (!course.organizationId) {
    throw new Error("Live sessions require an organization-owned course.");
  }

  return prisma.liveSession.create({
    data: {
      organizationId: course.organizationId,
      courseId: course.id,
      instructorId: input.actor.id,
      title: input.title,
      providerUrl: input.providerUrl,
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes ?? 60,
    },
  });
}
