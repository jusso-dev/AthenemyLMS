import { prisma } from "@/lib/prisma";

export function createCertificateNumber(date = new Date(), entropy = crypto.randomUUID()) {
  const year = date.getUTCFullYear();
  const token = entropy.replaceAll("-", "").slice(0, 10).toUpperCase();
  return `ATH-${year}-${token}`;
}

export async function issueCertificate(userId: string, courseId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: { course: true },
  });

  if (!enrollment || enrollment.status !== "COMPLETED") {
    throw new Error("Course must be completed before issuing a certificate.");
  }
  if (!enrollment.course.certificatesEnabled) {
    throw new Error("Certificates are not enabled for this course.");
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
