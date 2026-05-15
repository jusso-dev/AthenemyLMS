import { beforeEach, describe, expect, it, vi } from "vitest";
import { lessonVideoSchema } from "@/lib/course-schemas";
import { formatVideoBytes, getVideoPlayback } from "@/lib/video";

const mocks = vi.hoisted(() => ({
  prisma: {
    lesson: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  requireAppUser: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ requireAppUser: mocks.requireAppUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { updateLessonVideoAction } from "@/app/dashboard/courses/actions";

describe("lesson video strategy", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/athenemy";
    vi.clearAllMocks();
    mocks.requireAppUser.mockResolvedValue({
      id: "instructor_1",
      role: "INSTRUCTOR",
      clerkId: "clerk_1",
      email: "instructor@example.com",
      name: "Instructor",
      imageUrl: null,
    });
    mocks.prisma.lesson.findUnique.mockResolvedValue({
      id: "lesson_1",
      section: {
        courseId: "course_1",
        course: { id: "course_1", instructorId: "instructor_1" },
      },
    });
    mocks.prisma.lesson.update.mockResolvedValue({});
  });

  it("validates R2-hosted video metadata", () => {
    const result = lessonVideoSchema.safeParse({
      videoProvider: "R2",
      videoUrl: "https://cdn.example.com/videos/lesson.mp4",
      videoAssetKey: "videos/user/lesson.mp4",
      videoMimeType: "video/mp4",
      videoBytes: "10485760",
    });

    expect(result.success).toBe(true);
  });

  it("normalizes supported playback URLs", () => {
    expect(getVideoPlayback("https://youtu.be/abc123")).toMatchObject({
      kind: "iframe",
      src: "https://www.youtube-nocookie.com/embed/abc123",
    });
    expect(getVideoPlayback("https://cdn.example.com/videos/lesson.mp4")).toMatchObject({
      kind: "video",
    });
    expect(formatVideoBytes(10 * 1024 * 1024)).toBe("10 MB");
  });

  it("persists video metadata for an owned lesson", async () => {
    const formData = new FormData();
    formData.set("videoProvider", "R2");
    formData.set("videoUrl", "https://cdn.example.com/videos/lesson.mp4");
    formData.set("videoAssetKey", "videos/user/lesson.mp4");
    formData.set("videoMimeType", "video/mp4");
    formData.set("videoBytes", "10485760");

    await updateLessonVideoAction("course_1", "lesson_1", formData);

    expect(mocks.prisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "lesson_1" },
      data: {
        videoUrl: "https://cdn.example.com/videos/lesson.mp4",
        videoProvider: "R2",
        videoAssetKey: "videos/user/lesson.mp4",
        videoMimeType: "video/mp4",
        videoBytes: 10485760,
      },
    });
  });
});
