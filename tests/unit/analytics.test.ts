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

  it("does not turn lesson activity into a fabricated completion percentage", () => {
    const metrics = summarizeCourseMetrics(
      [
        {
          id: "course_1",
          title: "Security",
          level: "Beginner",
          status: "PUBLISHED",
        },
      ],
      [{ courseId: "course_1", status: "ACTIVE", count: 40 }],
      [],
      [{ id: "lesson_1", courseId: "course_1" }],
      [{ lessonId: "lesson_1", count: 30 }],
    );
    expect(metrics[0]).toMatchObject({ completionRate: 0, progressScore: 0 });
  });

  it("counts only published courses and describes lifetime revenue", () => {
    const metrics = summarizeCourseMetrics(
      ["PUBLISHED", "DRAFT", "ARCHIVED"].map((status, index) => ({
        id: `course_${index}`,
        title: status,
        level: "Beginner",
        status,
      })),
      [],
      [{ courseId: "course_2", revenueCents: 2500 }],
      [],
      [],
    );
    expect(summarizePlatformStats(metrics, 0).dashboard).toContainEqual({
      label: "Published courses",
      value: "1",
    });
    expect(summarizePlatformStats(metrics, 0).dashboard).toContainEqual({
      label: "Lifetime revenue",
      value: "$25.00",
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
  it("exports spreadsheet-like text literally and escapes headers and carriage returns", () => {
    expect(
      toCsv([{ "learner,name": "=literal", note: "line\rbreak", amount: -5 }]),
    ).toBe('"learner,name",note,amount\n\'=literal,"line\rbreak",-5\n');
    for (const value of ["+literal", "-literal", "@literal", "  =literal"]) {
      expect(toCsv([{ text: value }])).toBe(`text\n'${value}\n`);
    }
  });
});
