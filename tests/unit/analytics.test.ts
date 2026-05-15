import { describe, expect, it } from "vitest";
import {
  summarizeCourseMetrics,
  summarizePlatformStats,
} from "@/lib/analytics";

describe("analytics summaries", () => {
  it("derives course metrics from fact tables when rollups are absent", () => {
    const courses = [
      {
        id: "course_1",
        title: "Course Design Foundations",
        level: "Beginner",
        status: "PUBLISHED",
      },
    ];

    const metrics = summarizeCourseMetrics(
      courses,
      [],
      [
        { courseId: "course_1", status: "ACTIVE", count: 8 },
        { courseId: "course_1", status: "COMPLETED", count: 2 },
      ],
      [{ courseId: "course_1", revenueCents: 9800 }],
      [
        { id: "lesson_1", courseId: "course_1" },
        { id: "lesson_2", courseId: "course_1" },
      ],
      [
        { lessonId: "lesson_1", count: 6 },
        { lessonId: "lesson_2", count: 4 },
      ],
    );

    expect(metrics[0]).toMatchObject({
      activeEnrollments: 8,
      completedEnrollments: 2,
      completionRate: 20,
      lessonCompletions: 10,
      revenueCents: 9800,
    });
  });

  it("uses persisted rollups ahead of derived facts", () => {
    const metrics = summarizeCourseMetrics(
      [
        {
          id: "course_1",
          title: "Course Design Foundations",
          level: "Beginner",
          status: "PUBLISHED",
        },
      ],
      [
        {
          courseId: "course_1",
          activeEnrollments: 12,
          completedEnrollments: 6,
          lessonCompletions: 80,
          revenueCents: 24000,
        },
      ],
      [{ courseId: "course_1", status: "ACTIVE", count: 1 }],
      [{ courseId: "course_1", revenueCents: 100 }],
      [],
      [],
    );

    expect(metrics[0]).toMatchObject({
      activeEnrollments: 12,
      completedEnrollments: 6,
      completionRate: 33,
      lessonCompletions: 80,
      revenueCents: 24000,
    });
  });

  it("summarizes platform dashboard and admin totals", () => {
    const totals = summarizePlatformStats(
      [
        {
          id: "course_1",
          title: "Course Design Foundations",
          level: "Beginner",
          status: "PUBLISHED",
          activeEnrollments: 8,
          completedEnrollments: 2,
          completionRate: 20,
          lessonCompletions: 10,
          revenueCents: 9800,
          progressScore: 20,
        },
      ],
      4,
    );

    expect(totals.dashboard).toContainEqual({
      label: "Completion rate",
      value: "20%",
    });
    expect(totals.admin).toContainEqual({ label: "Users", value: "4" });
    expect(totals.admin).toContainEqual({ label: "Payments", value: "$98.00" });
  });
});
