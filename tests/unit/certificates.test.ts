vi.mock("@/lib/learning-events", () => ({ recordCourseEvent: vi.fn() }));
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCertificateNumber,
  getCertificateVerification,
  issueCertificate,
} from "@/lib/certificates";
import { generateCertificatePdf } from "@/lib/certificate-pdf";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    externalPackage: { findMany: vi.fn(), count: vi.fn() },
    lesson: { count: vi.fn() },
    lessonProgress: { count: vi.fn() },
    enrollment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    certificate: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    assessment: {
      findMany: vi.fn(),
    },
    assessmentSubmission: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

describe("certificates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.externalPackage.findMany.mockResolvedValue([]);
    mocks.prisma.externalPackage.count.mockResolvedValue(0);
    mocks.prisma.$transaction.mockImplementation((operation) =>
      operation(mocks.prisma),
    );
    mocks.prisma.lesson.count.mockResolvedValue(2);
    mocks.prisma.lessonProgress.count.mockResolvedValue(2);
    mocks.prisma.assessment.findMany.mockResolvedValue([]);
    mocks.prisma.assessmentSubmission.findMany.mockResolvedValue([]);
  });

  it("creates stable public certificate numbers", () => {
    expect(
      createCertificateNumber(
        new Date("2026-05-15T00:00:00Z"),
        "12345678-90ab-cdef-1234-567890abcdef",
      ),
    ).toBe("ATH-2026-1234567890");
  });

  it("issues one certificate for a completed enrollment", async () => {
    mocks.prisma.enrollment.findUnique.mockResolvedValue({
      status: "COMPLETED",
      course: { certificatesEnabled: true },
    });
    mocks.prisma.certificate.upsert.mockResolvedValue({
      certificateNumber: "ATH-2026-ABC",
    });

    await issueCertificate("user_1", "course_1");

    expect(mocks.prisma.certificate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_courseId: { userId: "user_1", courseId: "course_1" } },
        create: expect.objectContaining({
          userId: "user_1",
          courseId: "course_1",
        }),
      }),
    );
  });

  it("rejects incomplete enrollments", async () => {
    mocks.prisma.lessonProgress.count.mockResolvedValue(1);
    mocks.prisma.enrollment.findUnique.mockResolvedValue({
      status: "ACTIVE",
      course: { certificatesEnabled: true },
    });

    await expect(issueCertificate("user_1", "course_1")).rejects.toThrow(
      "completed",
    );
  });

  it("requires passing completion-gated assessments before certificate issue", async () => {
    mocks.prisma.enrollment.findUnique.mockResolvedValue({
      status: "COMPLETED",
      course: { certificatesEnabled: true },
    });
    mocks.prisma.assessment.findMany.mockResolvedValue([
      { id: "assessment_1", title: "Final check" },
    ]);
    mocks.prisma.assessmentSubmission.findMany.mockResolvedValue([]);

    await expect(issueCertificate("user_1", "course_1")).rejects.toThrow(
      "Required assessments",
    );
    expect(mocks.prisma.certificate.upsert).not.toHaveBeenCalled();
  });

  it("reconciles previously completed work before issuing a certificate", async () => {
    mocks.prisma.enrollment.findUnique.mockResolvedValue({
      status: "ACTIVE",
      course: { certificatesEnabled: true },
    });
    await issueCertificate("user_1", "course_1");
    expect(mocks.prisma.enrollment.update).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: "user_1", courseId: "course_1" } },
      data: { status: "COMPLETED" },
    });
  });

  it("rejects revoked enrollments even when all work is complete", async () => {
    mocks.prisma.enrollment.findUnique.mockResolvedValue({
      status: "CANCELLED",
      course: { certificatesEnabled: true },
    });
    await expect(issueCertificate("user_1", "course_1")).rejects.toThrow(
      "completed",
    );
    expect(mocks.prisma.certificate.upsert).not.toHaveBeenCalled();
  });

  it("does not trust a stale completed status after lessons are added", async () => {
    mocks.prisma.enrollment.findUnique.mockResolvedValue({
      status: "COMPLETED",
      course: { certificatesEnabled: true },
    });
    mocks.prisma.lessonProgress.count.mockResolvedValue(1);
    await expect(issueCertificate("user_1", "course_1")).rejects.toThrow(
      "All course lessons",
    );
  });

  it("selects only public verification fields", async () => {
    mocks.prisma.certificate.findUnique.mockResolvedValue(null);

    await getCertificateVerification("ATH-2026-ABC");

    expect(mocks.prisma.certificate.findUnique).toHaveBeenCalledWith({
      where: { certificateNumber: "ATH-2026-ABC" },
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
  });

  it("generates a downloadable PDF certificate", async () => {
    const pdf = await generateCertificatePdf({
      certificateNumber: "ATH-2026-ABC",
      issuedAt: new Date("2026-05-15T00:00:00Z"),
      recipientName: "Ada Lovelace",
      course: {
        title: "Wombat Mange Carer Coordination",
        instructor: { name: "Athenemy faculty" },
      },
    });

    expect(Buffer.from(pdf.subarray(0, 5)).toString("utf8")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
