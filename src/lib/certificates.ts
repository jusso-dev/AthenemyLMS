import { recordCourseEvent } from "@/lib/learning-events";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  getLearningCompletion,
  hasLearningAccess,
  learningTransaction,
  reconcileLearningCompletion,
} from "@/lib/learning";

export function createCertificateNumber(
  date = new Date(),
  entropy = crypto.randomUUID(),
) {
  const year = date.getUTCFullYear();
  const token = entropy.replaceAll("-", "").slice(0, 10).toUpperCase();
  return `ATH-${year}-${token}`;
}

export async function issueCertificate(userId: string, courseId: string) {
  return learningTransaction(async (database) => {
    const eligibility = await getCertificateEligibility(
      userId,
      courseId,
      database,
    );
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason);
    }

    await reconcileLearningCompletion(database, userId, courseId);
    const certificate = await database.certificate.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {},
      create: {
        userId,
        courseId,
        certificateNumber: createCertificateNumber(),
      },
    });
    await recordCourseEvent(database, {
      userId,
      courseId,
      type: "certificate.issued",
      idempotencyKey: `certificate-issued:${certificate.id}`,
      payload: { certificateNumber: certificate.certificateNumber },
    });
    return certificate;
  });
}

export async function getCertificateEligibility(
  userId: string,
  courseId: string,
  database: Prisma.TransactionClient = prisma,
) {
  const enrollment = await database.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: { course: true },
  });

  if (!enrollment || !hasLearningAccess(enrollment)) {
    return {
      eligible: false,
      reason: "Course must be completed before issuing a certificate.",
    };
  }
  if (!enrollment.course.certificatesEnabled) {
    return {
      eligible: false,
      reason: "Certificates are not enabled for this course.",
    };
  }

  const completion = await getLearningCompletion(userId, courseId, database);
  if (
    !completion.totalLessons ||
    completion.completedLessons !== completion.totalLessons
  ) {
    return {
      eligible: false,
      reason:
        "All course lessons must be completed before issuing a certificate.",
    };
  }
  if (completion.missingAssessments.length > 0) {
    return {
      eligible: false,
      reason:
        "Required assessments must be passed before issuing a certificate.",
      missingAssessments: completion.missingAssessments,
    };
  }

  if (completion.missingScorm.length > 0) {
    return {
      eligible: false,
      reason:
        "Required SCORM packages must be completed before issuing a certificate.",
      missingScorm: completion.missingScorm,
    };
  }
  return { eligible: true, reason: "Certificate is available." };
}

export async function getCertificateVerification(certificateNumber: string) {
  return prisma.certificate.findUnique({
    where: { certificateNumber },
    select: {
      certificateNumber: true,
      issuedAt: true,
      user: { select: { name: true } },
      course: {
        select: {
          title: true,
          instructor: { select: { name: true } },
        },
      },
    },
  });
}
