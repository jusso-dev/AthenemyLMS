import { describe, expect, it } from "vitest";
import {
  getLearnerRiskSignal,
  summarizeCourseMetrics,
  summarizePlatformStats,
  toCsv,
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

  it("flags learner risk from inactivity, low progress, and failed gates", () => {
    const now = new Date("2026-05-16T00:00:00Z");

    expect(
      getLearnerRiskSignal({
        progressPercent: 80,
        enrolledAt: new Date("2026-05-01T00:00:00Z"),
        lastActivityAt: new Date("2026-05-15T00:00:00Z"),
        failedRequiredAssessments: 1,
        now,
      }).level,
    ).toBe("high");

    expect(
      getLearnerRiskSignal({
        progressPercent: 10,
        enrolledAt: new Date("2026-05-01T00:00:00Z"),
        lastActivityAt: new Date("2026-05-14T00:00:00Z"),
        now,
      }).label,
    ).toBe("Low progress");
  });

  it("serializes report rows as CSV", () => {
    expect(
      toCsv([
        {
          learner: "Ada, Example",
          email: "ada@example.com",
          progressPercent: 100,
        },
      ]),
    ).toBe(
      'learner,email,progressPercent\n"Ada, Example",ada@example.com,100\n',
    );
  });
});
