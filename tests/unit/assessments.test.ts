import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessmentSchema } from "@/lib/course-schemas";
import {
  assertSupportedAssessmentSettings,
  assessmentDeadline,
  canShowAssessmentFeedback,
  parseAssessmentAnswers,
  parseQuizOptions,
  scoreQuiz,
} from "@/lib/assessments";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    enrollment: { findUnique: vi.fn(), update: vi.fn() },
    lesson: { count: vi.fn() },
    lessonProgress: { count: vi.fn() },
    course: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    user: { findUniqueOrThrow: vi.fn() },
    assessment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    assessmentAttempt: {
      findFirst: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    learningEvent: { upsert: vi.fn() },
    externalPackage: { findMany: vi.fn() },
    assessmentSubmission: {
      count: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
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

import {
  createAssessmentAction,
  submitAssessmentAction,
} from "@/app/dashboard/courses/actions";
import { getCompletionGateStatus } from "@/lib/assessments";

describe("assessments", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/athenemy";
    vi.clearAllMocks();
    mocks.prisma.course.findUniqueOrThrow.mockResolvedValue({
      title: "Course",
      organizationId: null,
    });
    mocks.prisma.user.findUniqueOrThrow.mockResolvedValue({
      name: "Learner",
      email: "learner@example.test",
    });
    mocks.prisma.externalPackage.findMany.mockResolvedValue([]);
    mocks.prisma.assessmentAttempt.findFirst.mockResolvedValue(null);
    mocks.prisma.assessmentAttempt.aggregate.mockResolvedValue({
      _max: { attemptNumber: null },
    });
    mocks.prisma.assessmentSubmission.aggregate.mockResolvedValue({
      _max: { attemptNumber: null },
    });
    mocks.prisma.assessmentAttempt.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: "attempt_1", ...data }),
    );
    mocks.prisma.$transaction.mockImplementation((operation) =>
      operation(mocks.prisma),
    );
    mocks.prisma.enrollment.findUnique.mockResolvedValue({ status: "ACTIVE" });
    mocks.prisma.lesson.count.mockResolvedValue(1);
    mocks.prisma.lessonProgress.count.mockResolvedValue(0);
    mocks.prisma.assessment.findMany.mockResolvedValue([]);
    mocks.requireAppUser.mockResolvedValue({
      id: "user_1",
      role: "INSTRUCTOR",
      clerkId: "clerk_1",
      email: "instructor@example.com",
      name: "Instructor",
      imageUrl: null,
    });
  });

  it("validates quiz assessment authoring payloads", () => {
    const result = assessmentSchema.safeParse({
      title: "Module check",
      prompt: "What is a useful outcome?",
      options: "Specific\nVague",
      correctIndex: "0",
      passingScore: "70",
      requiredForCompletion: "true",
    });

    expect(result.success).toBe(true);
    expect(parseQuizOptions("Specific\n\nVague")).toEqual([
      "Specific",
      "Vague",
    ]);
  });

  it("scores quiz responses", () => {
    expect(
      scoreQuiz(
        [
          { id: "q1", correctIndex: 0 },
          { id: "q2", correctIndex: 1 },
        ],
        { q1: 0, q2: 0 },
      ),
    ).toBe(50);
  });

  it("creates a required quiz for an owning instructor", async () => {
    mocks.prisma.course.findUnique.mockResolvedValue({
      id: "course_1",
      instructorId: "user_1",
    });
    mocks.prisma.assessment.create.mockResolvedValue({});

    const formData = new FormData();
    formData.set("title", "Module check");
    formData.set("prompt", "What is a useful outcome?");
    formData.set("options", "Specific\nVague");
    formData.set("correctIndex", "0");
    formData.set("passingScore", "70");
    formData.set("requiredForCompletion", "on");

    await createAssessmentAction("course_1", formData);

    expect(mocks.prisma.assessment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        courseId: "course_1",
        requiredForCompletion: true,
        questions: {
          create: expect.objectContaining({
            options: ["Specific", "Vague"],
            correctIndex: 0,
          }),
        },
      }),
    });
  });

  it("persists scored student submissions", async () => {
    mocks.requireAppUser.mockResolvedValue({
      id: "student_1",
      role: "STUDENT",
      clerkId: "clerk_student",
      email: "student@example.com",
      name: "Student",
      imageUrl: null,
    });
    mocks.prisma.assessment.findUnique.mockResolvedValue({
      id: "assessment_1",
      courseId: "course_1",
      passingScore: 70,
      maxAttempts: null,
      questions: [{ id: "q1", correctIndex: 0, options: ["First", "Second"] }],
    });
    mocks.prisma.assessmentSubmission.count.mockResolvedValue(0);
    mocks.prisma.assessmentSubmission.create.mockResolvedValue({});

    const formData = new FormData();
    formData.set("question-q1", "0");

    await submitAssessmentAction("course_1", "assessment_1", formData);

    expect(mocks.prisma.assessmentSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "student_1",
        assessmentId: "assessment_1",
        attemptNumber: 1,
        score: 100,
        passed: true,
      }),
    });
  });

  it("blocks submissions after the configured attempt limit", async () => {
    mocks.requireAppUser.mockResolvedValue({
      id: "student_1",
      role: "STUDENT",
      clerkId: "clerk_student",
      email: "student@example.com",
      name: "Student",
      imageUrl: null,
    });
    mocks.prisma.assessment.findUnique.mockResolvedValue({
      id: "assessment_1",
      courseId: "course_1",
      passingScore: 70,
      maxAttempts: 1,
      questions: [{ id: "q1", correctIndex: 0, options: ["First", "Second"] }],
    });
    mocks.prisma.assessmentSubmission.aggregate.mockResolvedValue({
      _max: { attemptNumber: 1 },
    });

    await expect(
      submitAssessmentAction("course_1", "assessment_1", new FormData()),
    ).rejects.toThrow("used all attempts");
    expect(mocks.prisma.assessmentSubmission.create).not.toHaveBeenCalled();
  });

  it("reports missing required gates", async () => {
    mocks.prisma.assessment.findMany.mockResolvedValue([
      { id: "assessment_1", title: "Module check" },
    ]);
    mocks.prisma.assessmentSubmission.findMany.mockResolvedValue([]);

    await expect(
      getCompletionGateStatus("student_1", "course_1"),
    ).resolves.toMatchObject({
      required: true,
      passed: false,
      missing: [{ id: "assessment_1", title: "Module check" }],
    });
  });

  it.each([null, "", " ", "1.5", "-1", "2", "hello"])(
    "rejects invalid answer %s before scoring",
    (value) => {
      const data = new FormData();
      if (value !== null) data.set("question-q1", value);
      expect(() =>
        parseAssessmentAnswers([{ id: "q1", options: ["A", "B"] }], data),
      ).toThrow("valid answer");
    },
  );

  it.each([null, { status: "CANCELLED" }])(
    "denies submission without active enrollment (%s)",
    async (enrollment) => {
      mocks.prisma.enrollment.findUnique.mockResolvedValue(enrollment);
      mocks.prisma.assessment.findUnique.mockResolvedValue({
        id: "a1",
        courseId: "c1",
        course: { instructorId: "other" },
        questions: [],
      });
      await expect(
        submitAssessmentAction("c1", "a1", new FormData()),
      ).rejects.toThrow("enrolled");
      expect(mocks.prisma.assessmentSubmission.create).not.toHaveBeenCalled();
    },
  );

  it("completes enrollment when the final required assessment passes", async () => {
    mocks.prisma.assessment.findUnique.mockResolvedValue({
      id: "a1",
      courseId: "c1",
      course: { instructorId: "other" },
      passingScore: 70,
      questions: [{ id: "q1", correctIndex: 1, options: ["A", "B"] }],
    });
    mocks.prisma.assessmentSubmission.count.mockResolvedValue(0);
    mocks.prisma.lessonProgress.count.mockResolvedValue(1);
    const data = new FormData();
    data.set("question-q1", "1");
    await submitAssessmentAction("c1", "a1", data);
    expect(mocks.prisma.enrollment.update).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: "user_1", courseId: "c1" } },
      data: { status: "COMPLETED" },
    });
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" },
    );
  });

  it("enforces supported feedback visibility", () => {
    expect(canShowAssessmentFeedback("IMMEDIATE", false)).toBe(true);
    expect(canShowAssessmentFeedback("AFTER_PASSING", false)).toBe(false);
    expect(canShowAssessmentFeedback("AFTER_PASSING", true)).toBe(true);
    expect(canShowAssessmentFeedback("HIDDEN", true)).toBe(false);
    expect(canShowAssessmentFeedback("AFTER_CLOSE", true)).toBe(false);
  });

  it("supports timed policies and requires a valid close time for scheduled feedback", () => {
    expect(() =>
      assertSupportedAssessmentSettings({
        timeLimitMinutes: 5,
        feedbackMode: "IMMEDIATE",
      }),
    ).not.toThrow();
    expect(() =>
      assertSupportedAssessmentSettings({ feedbackMode: "AFTER_CLOSE" }),
    ).toThrow("closing time");
    expect(() =>
      assertSupportedAssessmentSettings({
        feedbackMode: "AFTER_CLOSE",
        closesAt: "invalid",
      }),
    ).toThrow("valid closing time");
    expect(() =>
      assertSupportedAssessmentSettings({
        feedbackMode: "AFTER_CLOSE",
        closesAt: new Date(),
      }),
    ).not.toThrow();
  });
  it("releases scheduled feedback exactly at the server closing time", () => {
    const close = new Date("2026-12-01T00:00:00Z");
    expect(
      canShowAssessmentFeedback(
        "AFTER_CLOSE",
        true,
        close,
        new Date(close.getTime() - 1),
      ),
    ).toBe(false);
    expect(canShowAssessmentFeedback("AFTER_CLOSE", false, close, close)).toBe(
      true,
    );
    expect(canShowAssessmentFeedback("HIDDEN", true, close, close)).toBe(false);
  });
  it("caps timed attempts at close and scores unanswered questions as incorrect", () => {
    const start = new Date("2026-12-01T00:00:00Z");
    const close = new Date(start.getTime() + 30_000);
    expect(assessmentDeadline(start, 1, null)?.getTime()).toBe(
      start.getTime() + 60_000,
    );
    expect(assessmentDeadline(start, 1, close)).toEqual(close);
    expect(assessmentDeadline(start, null, null)).toBeNull();
    const answers = parseAssessmentAnswers(
      [{ id: "q", options: ["A", "B"] }],
      new FormData(),
      true,
    );
    expect(scoreQuiz([{ id: "q", correctIndex: 0 }], answers)).toBe(0);
  });
  it("requires a timezone on authored closing dates", () => {
    const base = {
      title: "Quiz",
      prompt: "Choose one",
      options: "A\nB",
      correctIndex: 0,
    };
    expect(
      assessmentSchema.safeParse({ ...base, closesAt: "2026-12-01T17:00" })
        .success,
    ).toBe(false);
    expect(
      assessmentSchema.safeParse({
        ...base,
        closesAt: "2026-12-01T17:00:00+11:00",
      }).success,
    ).toBe(true);
  });
});
