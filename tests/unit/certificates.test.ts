import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCertificateNumber,
  getCertificateVerification,
  issueCertificate,
} from "@/lib/certificates";

const mocks = vi.hoisted(() => ({
  prisma: {
    enrollment: {
      findUnique: vi.fn(),
    },
    certificate: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

describe("certificates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mocks.prisma.enrollment.findUnique.mockResolvedValue({
      status: "ACTIVE",
      course: { certificatesEnabled: true },
    });

    await expect(issueCertificate("user_1", "course_1")).rejects.toThrow(
      "completed",
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
        course: {
          select: {
            title: true,
            instructor: { select: { name: true } },
          },
        },
      },
    });
  });
});
