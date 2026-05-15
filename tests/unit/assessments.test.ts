import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessmentSchema } from "@/lib/course-schemas";
import { parseQuizOptions, scoreQuiz } from "@/lib/assessments";

const mocks = vi.hoisted(() => ({
  prisma: {
    course: { findUnique: vi.fn() },
    assessment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    assessmentSubmission: {
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
    expect(parseQuizOptions("Specific\n\nVague")).toEqual(["Specific", "Vague"]);
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
      questions: [{ id: "q1", correctIndex: 0 }],
    });
    mocks.prisma.assessmentSubmission.create.mockResolvedValue({});

    const formData = new FormData();
    formData.set("question-q1", "0");

    await submitAssessmentAction("course_1", "assessment_1", formData);

    expect(mocks.prisma.assessmentSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "student_1",
        assessmentId: "assessment_1",
        score: 100,
        passed: true,
      }),
    });
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
});
