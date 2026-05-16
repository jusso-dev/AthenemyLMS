export type ReadinessCourse = {
  title: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  priceCents?: number | null;
  certificatesEnabled?: boolean | null;
  sections: Array<{
    title: string;
    lessons: Array<{
      title: string;
      content?: string | null;
      videoUrl?: string | null;
      videoAssetKey?: string | null;
      durationMinutes?: number | null;
    }>;
  }>;
  assessments?: Array<{
    id: string;
    requiredForCompletion?: boolean | null;
  }>;
};

export type CourseReadinessItem = {
  id: string;
  label: string;
  status: "complete" | "warning" | "blocked";
  message: string;
};

export function getCoursePublishReadiness(course: ReadinessCourse) {
  const lessonCount = course.sections.reduce(
    (total, section) => total + section.lessons.length,
    0,
  );
  const contentReadyLessons = course.sections.flatMap((section) =>
    section.lessons.filter((lesson) =>
      Boolean(
        lesson.content?.trim() ||
        lesson.videoUrl?.trim() ||
        lesson.videoAssetKey?.trim(),
      ),
    ),
  );
  const requiredAssessments =
    course.assessments?.filter((assessment) => assessment.requiredForCompletion)
      .length ?? 0;

  const items: CourseReadinessItem[] = [
    {
      id: "details",
      label: "Course details",
      status:
        course.title.trim().length >= 3 && isSafeSlug(course.slug)
          ? "complete"
          : "blocked",
      message:
        course.title.trim().length >= 3 && isSafeSlug(course.slug)
          ? "Title and URL slug are ready."
          : "Add a clear title and URL-safe slug.",
    },
    {
      id: "outline",
      label: "Outline",
      status:
        course.sections.length > 0 && lessonCount > 0 ? "complete" : "blocked",
      message:
        course.sections.length > 0 && lessonCount > 0
          ? `${course.sections.length} sections and ${lessonCount} lessons are ready.`
          : "Add at least one section with one lesson.",
    },
    {
      id: "lesson-content",
      label: "Lesson content",
      status:
        lessonCount > 0 && contentReadyLessons.length === lessonCount
          ? "complete"
          : lessonCount > 0
            ? "warning"
            : "blocked",
      message:
        lessonCount === 0
          ? "Add lesson content before publishing."
          : contentReadyLessons.length === lessonCount
            ? "Every lesson has notes or video."
            : `${lessonCount - contentReadyLessons.length} lessons need notes or video.`,
    },
    {
      id: "listing",
      label: "Listing",
      status:
        course.subtitle?.trim() || course.description?.trim()
          ? "complete"
          : "warning",
      message:
        course.subtitle?.trim() || course.description?.trim()
          ? "The course has catalogue copy."
          : "Add a subtitle or description so learners know what this course covers.",
    },
    {
      id: "thumbnail",
      label: "Thumbnail",
      status: course.thumbnailUrl?.trim() ? "complete" : "warning",
      message: course.thumbnailUrl?.trim()
        ? "A thumbnail is set."
        : "Add a thumbnail to improve catalogue and portal presentation.",
    },
    {
      id: "assessment",
      label: "Assessment",
      status: requiredAssessments > 0 ? "complete" : "warning",
      message:
        requiredAssessments > 0
          ? "A required assessment is configured."
          : "Consider adding a required assessment for stronger completion evidence.",
    },
  ];

  const blockers = items.filter((item) => item.status === "blocked");
  const warnings = items.filter((item) => item.status === "warning");
  const score = Math.round(
    (items.filter((item) => item.status === "complete").length / items.length) *
      100,
  );

  return {
    items,
    blockers,
    warnings,
    score,
    canPublish: blockers.length === 0,
  };
}

function isSafeSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
