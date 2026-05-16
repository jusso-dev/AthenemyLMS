import { prisma } from "@/lib/prisma";
import { getCompletionGateStatus } from "@/lib/assessments";

export function createCertificateNumber(
  date = new Date(),
  entropy = crypto.randomUUID(),
) {
  const year = date.getUTCFullYear();
  const token = entropy.replaceAll("-", "").slice(0, 10).toUpperCase();
  return `ATH-${year}-${token}`;
}

export async function issueCertificate(userId: string, courseId: string) {
  const eligibility = await getCertificateEligibility(userId, courseId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason);
  }

  return prisma.certificate.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: {},
    create: {
      userId,
      courseId,
      certificateNumber: createCertificateNumber(),
    },
  });
}

export async function getCertificateEligibility(
  userId: string,
  courseId: string,
) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: { course: true },
  });

  if (!enrollment || enrollment.status !== "COMPLETED") {
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

  const gates = await getCompletionGateStatus(userId, courseId);
  if (!gates.passed) {
    return {
      eligible: false,
      reason:
        "Required assessments must be passed before issuing a certificate.",
      missingAssessments: gates.missing,
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
