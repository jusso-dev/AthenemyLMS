import { describe, expect, it } from "vitest";
import { getCoursePublishReadiness } from "@/lib/course-readiness";

describe("course publish readiness", () => {
  it("blocks publishing until a course has details, outline, and lesson content", () => {
    const readiness = getCoursePublishReadiness({
      title: "Awareness",
      slug: "awareness",
      sections: [],
      assessments: [],
    });

    expect(readiness.canPublish).toBe(false);
    expect(readiness.blockers.map((item) => item.id)).toEqual([
      "outline",
      "lesson-content",
    ]);
  });

  it("allows publishing with warnings for optional merchandising fields", () => {
    const readiness = getCoursePublishReadiness({
      title: "Cyber Security Awareness",
      slug: "cyber-security-awareness",
      sections: [
        {
          title: "Start here",
          lessons: [
            {
              title: "Recognise phishing",
              content: "Look for urgent requests and suspicious links.",
              durationMinutes: 8,
            },
          ],
        },
      ],
      assessments: [],
    });

    expect(readiness.canPublish).toBe(true);
    expect(readiness.warnings.map((item) => item.id)).toEqual([
      "listing",
      "thumbnail",
      "assessment",
    ]);
  });
});
