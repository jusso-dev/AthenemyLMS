import { beforeEach, describe, expect, it, vi } from "vitest";
import { courseExportSchema, importCourse } from "@/lib/course-import-export";

const mocks = vi.hoisted(() => ({
  prisma: {
    course: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

const exportFile = {
  format: "athenemy.course.v1",
  exportedAt: "2026-05-15T00:00:00.000Z",
  course: {
    title: "Course Design Foundations",
    slug: "course-design-foundations",
    subtitle: "Build courses",
    description: "Course body",
    thumbnailUrl: null,
    priceCents: 0,
    currency: "usd",
    status: "PUBLISHED",
    level: "Beginner",
    durationMinutes: 30,
    sections: [
      {
        title: "Start",
        position: 0,
        lessons: [
          {
            title: "Outcomes",
            slug: "outcomes",
            content: "Lesson",
            videoUrl: null,
            durationMinutes: 10,
            preview: true,
            position: 0,
            resources: [
              {
                title: "Worksheet",
                fileUrl: "https://cdn.example.com/worksheet.pdf",
                fileKey: "resources/worksheet.pdf",
                fileType: "application/pdf",
                fileSize: 1200,
              },
            ],
          },
        ],
      },
    ],
  },
} as const;

describe("course import/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.course.findUnique.mockResolvedValue(null);
    mocks.prisma.course.create.mockResolvedValue({
      id: "course_1",
      slug: "course-design-foundations",
    });
  });

  it("validates the portable course format", () => {
    expect(courseExportSchema.safeParse(exportFile).success).toBe(true);
  });

  it("imports validated courses as instructor-owned drafts", async () => {
    await importCourse(exportFile, "admin_1");

    expect(mocks.prisma.course.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        instructorId: "admin_1",
        status: "DRAFT",
        sections: {
          create: [
            expect.objectContaining({
              lessons: {
                create: [
                  expect.objectContaining({
                    resources: {
                      create: [
                        expect.objectContaining({
                          fileUrl: "https://cdn.example.com/worksheet.pdf",
                        }),
                      ],
                    },
                  }),
                ],
              },
            }),
          ],
        },
      }),
    });
  });

  it("adds an import suffix when the slug already exists", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1234);
    mocks.prisma.course.findUnique.mockResolvedValue({ id: "existing" });

    await importCourse(exportFile, "admin_1");

    expect(mocks.prisma.course.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: "course-design-foundations-import-1234",
      }),
    });
  });

  it("rejects invalid import files", () => {
    expect(courseExportSchema.safeParse({ format: "wrong" }).success).toBe(false);
  });
});
