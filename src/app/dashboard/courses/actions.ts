"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assessmentSchema,
  assessmentQuestionSchema,
  assessmentSettingsSchema,
  courseSchema,
  lessonContentSchema,
  lessonSchema,
  lessonVideoSchema,
  profileSchema,
  sectionSchema,
} from "@/lib/course-schemas";
import { missingEnv } from "@/lib/env";
import { canManageCourse, hasRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { issueCertificate } from "@/lib/certificates";
import { sendCoursePublishedEmail } from "@/lib/email";
import { parseQuizOptions, scoreQuiz } from "@/lib/assessments";
import { slugify } from "@/lib/utils";
import {
  buildPresentationCourseDraft,
  fetchGoogleSlidesAsPptx,
} from "@/lib/presentation-import";
import {
  actionError,
  actionSuccess,
  formatActionError,
  type ActionFormState,
} from "@/lib/action-state";

export type CourseFormState = ActionFormState;

export async function createCourseAction(formData: FormData) {
  let courseId: string;

  try {
    assertDatabaseConfigured();
    const course = await createCourse(formData);
    courseId = course.id;
  } catch (error) {
    return redirect(
      `/dashboard/courses/new?error=${encodeURIComponent(formatActionError(error))}`,
    );
  }

  revalidatePath("/dashboard/courses");
  redirect(`/dashboard/courses/${courseId}/edit`);
}

export async function createCourseFormAction(
  _previousState: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  let courseId: string;

  try {
    assertDatabaseConfigured();
    const course = await createCourse(formData);
    courseId = course.id;
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/dashboard/courses");
  redirect(`/dashboard/courses/${courseId}/edit`);
}

export async function importPresentationCourseFormAction(
  _previousState: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  let courseId: string;

  try {
    assertDatabaseConfigured();
    const course = await importPresentationCourse(formData);
    courseId = course.id;
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/dashboard/courses");
  redirect(`/dashboard/courses/${courseId}/curriculum`);
}

export async function updateCourseFormAction(
  courseId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => updateCourseAction(courseId, formData),
    "Course details saved.",
  );
}

export async function publishCourseFormAction(
  courseId: string,
  _previousState: ActionFormState,
  _formData: FormData,
) {
  void _formData;
  return runAction(() => publishCourseAction(courseId), "Course published.");
}

export async function createSectionFormAction(
  courseId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => createSectionAction(courseId, formData),
    "Section added.",
  );
}

export async function createLessonFormAction(
  sectionId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => createLessonAction(sectionId, formData),
    "Lesson added.",
  );
}

export async function moveSectionFormAction(
  courseId: string,
  sectionId: string,
  direction: "up" | "down",
  _previousState: ActionFormState,
  _formData: FormData,
) {
  void _formData;
  return runAction(
    () => moveSectionAction(courseId, sectionId, direction),
    "Section order saved.",
  );
}

export async function moveLessonFormAction(
  courseId: string,
  lessonId: string,
  direction: "up" | "down",
  _previousState: ActionFormState,
  _formData: FormData,
) {
  void _formData;
  return runAction(
    () => moveLessonAction(courseId, lessonId, direction),
    "Lesson order saved.",
  );
}

export async function updateLessonContentFormAction(
  courseId: string,
  lessonId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => updateLessonContentAction(courseId, lessonId, formData),
    "Lesson saved.",
  );
}

export async function updateLessonVideoFormAction(
  courseId: string,
  lessonId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => updateLessonVideoAction(courseId, lessonId, formData),
    "Video settings saved.",
  );
}

export async function createAssessmentFormAction(
  courseId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => createAssessmentAction(courseId, formData),
    "Assessment created.",
  );
}

export async function updateAssessmentFormAction(
  courseId: string,
  assessmentId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => updateAssessmentAction(courseId, assessmentId, formData),
    "Assessment saved.",
  );
}

export async function deleteAssessmentFormAction(
  courseId: string,
  assessmentId: string,
  _previousState: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  try {
    requireConfirmation(
      formData,
      "Confirm deleting this assessment and its submissions first.",
    );
    await deleteAssessmentAction(courseId, assessmentId);
  } catch (error) {
    return actionError(error);
  }

  revalidatePath(`/dashboard/courses/${courseId}/assessments`);
  revalidatePath(`/dashboard/learn/${courseId}`);
  redirect(`/dashboard/courses/${courseId}/assessments`);
}

export async function createAssessmentQuestionFormAction(
  courseId: string,
  assessmentId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => createAssessmentQuestionAction(courseId, assessmentId, formData),
    "Question added.",
  );
}

export async function updateAssessmentQuestionFormAction(
  courseId: string,
  assessmentId: string,
  questionId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () =>
      updateAssessmentQuestionAction(
        courseId,
        assessmentId,
        questionId,
        formData,
      ),
    "Question saved.",
  );
}

export async function moveAssessmentQuestionFormAction(
  courseId: string,
  assessmentId: string,
  questionId: string,
  direction: "up" | "down",
  _previousState: ActionFormState,
  _formData: FormData,
) {
  void _formData;
  return runAction(
    () =>
      moveAssessmentQuestionAction(
        courseId,
        assessmentId,
        questionId,
        direction,
      ),
    "Question order saved.",
  );
}

export async function deleteAssessmentQuestionFormAction(
  courseId: string,
  assessmentId: string,
  questionId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () =>
      deleteAssessmentQuestionAction(
        courseId,
        assessmentId,
        questionId,
        formData,
      ),
    "Question deleted.",
  );
}

export async function enrollCourseLearnerFormAction(
  courseId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => enrollCourseLearnerAction(courseId, formData),
    "Learner enrolled.",
  );
}

export async function cancelCourseEnrollmentFormAction(
  courseId: string,
  userId: string,
  _previousState: ActionFormState,
  _formData: FormData,
) {
  void _formData;
  return runAction(
    () => cancelCourseEnrollmentAction(courseId, userId),
    "Learner access cancelled.",
  );
}

export async function submitAssessmentFormAction(
  courseId: string,
  assessmentId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => submitAssessmentAction(courseId, assessmentId, formData),
    "Assessment submitted.",
  );
}

export async function updateProfileFormAction(
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(() => updateProfileAction(formData), "Profile saved.");
}

export async function markLessonCompleteFormAction(
  lessonId: string,
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => markLessonCompleteAction(lessonId, formData),
    "Lesson progress updated.",
  );
}

async function createCourse(formData: FormData) {
  const user = await requireAppUser();
  if (!hasRole(user.role, "INSTRUCTOR")) {
    throw new Error("Instructor or admin role required.");
  }

  const parsed = courseSchema.parse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    subtitle: formData.get("subtitle"),
    description: formData.get("description"),
    priceCents: formData.get("priceCents"),
    status: formData.get("status"),
    certificatesEnabled: formData.get("certificatesEnabled") === "on",
    thumbnailUrl: formData.get("thumbnailUrl"),
  });
  const organizationId = await primaryOrganizationIdForUser(user.id);

  const course = await prisma.course.create({
    data: {
      ...parsed,
      instructorId: user.id,
      organizationId,
      publishedAt: parsed.status === "PUBLISHED" ? new Date() : null,
    },
  });

  if (course.status === "PUBLISHED") {
    await sendCoursePublishedEmail({
      to: user.email,
      name: user.name ?? undefined,
      courseTitle: course.title,
    });
  }

  return course;
}

async function importPresentationCourse(formData: FormData) {
  const user = await requireAppUser();
  if (!hasRole(user.role, "INSTRUCTOR")) {
    throw new Error("Instructor or admin role required.");
  }

  const file = formData.get("presentationFile");
  const googleSlidesUrl = String(formData.get("googleSlidesUrl") ?? "").trim();
  let data: ArrayBuffer;
  let fileName: string;

  if (file instanceof File && file.size > 0) {
    if (!file.name.toLowerCase().endsWith(".pptx")) {
      throw new Error("Upload a PowerPoint .pptx file.");
    }
    data = await file.arrayBuffer();
    fileName = file.name;
  } else if (googleSlidesUrl) {
    data = await fetchGoogleSlidesAsPptx(googleSlidesUrl);
    fileName = "Google Slides presentation";
  } else {
    throw new Error("Upload a .pptx file or paste a Google Slides URL.");
  }

  const draft = await buildPresentationCourseDraft({ data, fileName });
  const organizationId = await primaryOrganizationIdForUser(user.id);

  return prisma.course.create({
    data: {
      title: draft.title,
      slug: await uniqueCourseSlug(draft.slug),
      subtitle: draft.subtitle,
      description: draft.description,
      status: "DRAFT",
      priceCents: 0,
      durationMinutes: draft.durationMinutes,
      instructorId: user.id,
      organizationId,
      sections: {
        create: {
          title: "Imported slides",
          position: 0,
          lessons: {
            create: draft.lessons.map((lesson) => ({
              title: lesson.title,
              slug: lesson.slug,
              content: lesson.content,
              durationMinutes: 5,
              position: lesson.position,
              preview: false,
            })),
          },
        },
      },
    },
  });
}

async function primaryOrganizationIdForUser(userId: string) {
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  return membership?.organizationId ?? null;
}

export async function issueCertificateAction(courseId: string) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const certificate = await issueCertificate(user.id, courseId);
  redirect(`/certificates/${certificate.certificateNumber}`);
}

export async function issueCertificateFormAction(
  courseId: string,
  _previousState: ActionFormState,
  _formData: FormData,
) {
  void _previousState;
  void _formData;
  let certificateNumber: string;

  try {
    assertDatabaseConfigured();
    const user = await requireAppUser();
    const certificate = await issueCertificate(user.id, courseId);
    certificateNumber = certificate.certificateNumber;
  } catch (error) {
    return actionError(error);
  }

  redirect(`/certificates/${certificateNumber}`);
}

export async function updateCourseAction(courseId: string, formData: FormData) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!canManageCourse(user, course)) {
    throw new Error("You do not have permission to manage this course.");
  }

  const parsed = courseSchema.parse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    subtitle: formData.get("subtitle"),
    description: formData.get("description"),
    priceCents: formData.get("priceCents"),
    status: formData.get("status"),
    certificatesEnabled: formData.get("certificatesEnabled") === "on",
    thumbnailUrl: formData.get("thumbnailUrl"),
  });

  await prisma.course.update({
    where: { id: courseId },
    data: {
      ...parsed,
      publishedAt:
        parsed.status === "PUBLISHED" && course?.publishedAt === null
          ? new Date()
          : course?.publishedAt,
    },
  });

  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${courseId}/edit`);
}

export async function publishCourseAction(courseId: string) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || !canManageCourse(user, course)) {
    throw new Error("You do not have permission to publish this course.");
  }
  if (course.status === "PUBLISHED") return;

  const publishedAt = course.publishedAt ?? new Date();
  const updatedCourse = await prisma.course.update({
    where: { id: courseId },
    data: {
      status: "PUBLISHED",
      publishedAt,
    },
  });

  await sendCoursePublishedEmail({
    to: user.email,
    name: user.name ?? undefined,
    courseTitle: updatedCourse.title,
  });

  revalidatePath("/");
  revalidatePath("/courses");
  revalidatePath(`/courses/${updatedCourse.slug}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${courseId}/edit`);
}

export async function createSectionAction(
  courseId: string,
  formData: FormData,
) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { _count: { select: { sections: true } } },
  });
  if (!course || !canManageCourse(user, course)) {
    throw new Error("You do not have permission to manage this course.");
  }

  const parsed = sectionSchema.parse({ title: formData.get("title") });
  await prisma.courseSection.create({
    data: {
      courseId,
      title: parsed.title,
      position: course._count.sections,
    },
  });

  revalidatePath(`/dashboard/courses/${courseId}/curriculum`);
}

export async function createLessonAction(
  sectionId: string,
  formData: FormData,
) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const section = await prisma.courseSection.findUnique({
    where: { id: sectionId },
    include: {
      course: true,
      _count: { select: { lessons: true } },
    },
  });
  if (!section || !canManageCourse(user, section.course)) {
    throw new Error("You do not have permission to manage this course.");
  }

  const title = String(formData.get("title") ?? "");
  const parsed = lessonSchema.parse({
    title,
    slug: formData.get("slug") || slugify(title),
    content: formData.get("content") ?? "",
    videoUrl: formData.get("videoUrl") ?? "",
    durationMinutes: formData.get("durationMinutes") ?? 0,
    preview: formData.get("preview") === "on",
  });

  await prisma.lesson.create({
    data: {
      ...parsed,
      sectionId,
      position: section._count.lessons,
    },
  });

  revalidatePath(`/dashboard/courses/${section.courseId}/curriculum`);
}

export async function moveSectionAction(
  courseId: string,
  sectionId: string,
  direction: "up" | "down",
) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      sections: { orderBy: { position: "asc" } },
    },
  });
  if (!course || !canManageCourse(user, course)) {
    throw new Error("You do not have permission to manage this course.");
  }

  const currentIndex = course.sections.findIndex(
    (section) => section.id === sectionId,
  );
  if (currentIndex === -1) throw new Error("Section not found.");

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= course.sections.length) return;

  const reordered = [...course.sections];
  const [section] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, section);

  await prisma.$transaction(
    reordered.map((item, position) =>
      prisma.courseSection.update({
        where: { id: item.id },
        data: { position },
      }),
    ),
  );

  revalidatePath(`/dashboard/courses/${courseId}/curriculum`);
  revalidatePath(`/dashboard/learn/${courseId}`);
}

export async function moveLessonAction(
  courseId: string,
  lessonId: string,
  direction: "up" | "down",
) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { section: { include: { course: true } } },
  });
  if (!lesson || lesson.section.courseId !== courseId) {
    throw new Error("Lesson not found.");
  }
  if (!canManageCourse(user, lesson.section.course)) {
    throw new Error("You do not have permission to manage this course.");
  }

  const sections = await prisma.courseSection.findMany({
    where: { courseId },
    orderBy: { position: "asc" },
    include: { lessons: { orderBy: { position: "asc" } } },
  });
  const structure = sections.map((section) => ({
    id: section.id,
    lessonIds: section.lessons.map((item) => item.id),
  }));
  const sectionIndex = structure.findIndex((section) =>
    section.lessonIds.includes(lessonId),
  );
  if (sectionIndex === -1) throw new Error("Lesson not found.");

  const currentLessons = structure[sectionIndex].lessonIds;
  const lessonIndex = currentLessons.indexOf(lessonId);

  if (direction === "up") {
    if (lessonIndex > 0) {
      currentLessons.splice(lessonIndex, 1);
      currentLessons.splice(lessonIndex - 1, 0, lessonId);
    } else if (sectionIndex > 0) {
      currentLessons.splice(lessonIndex, 1);
      structure[sectionIndex - 1].lessonIds.push(lessonId);
    } else {
      return;
    }
  }

  if (direction === "down") {
    if (lessonIndex < currentLessons.length - 1) {
      currentLessons.splice(lessonIndex, 1);
      currentLessons.splice(lessonIndex + 1, 0, lessonId);
    } else if (sectionIndex < structure.length - 1) {
      currentLessons.splice(lessonIndex, 1);
      structure[sectionIndex + 1].lessonIds.unshift(lessonId);
    } else {
      return;
    }
  }

  await prisma.$transaction(
    structure.flatMap((section) =>
      section.lessonIds.map((id, position) =>
        prisma.lesson.update({
          where: { id },
          data: { sectionId: section.id, position },
        }),
      ),
    ),
  );

  revalidatePath(`/dashboard/courses/${courseId}/curriculum`);
  revalidatePath(`/dashboard/learn/${courseId}`);
}

export async function updateLessonContentAction(
  courseId: string,
  lessonId: string,
  formData: FormData,
) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { section: { include: { course: true } } },
  });
  if (!lesson || lesson.section.courseId !== courseId) {
    throw new Error("Lesson not found.");
  }
  if (!canManageCourse(user, lesson.section.course)) {
    throw new Error("You do not have permission to edit this lesson.");
  }

  const parsed = lessonContentSchema.parse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    content: formData.get("content") ?? "",
    videoUrl: formData.get("videoUrl") ?? "",
    durationMinutes: formData.get("durationMinutes") ?? 0,
    preview: formData.get("preview") === "on",
  });

  await prisma.lesson.update({
    where: { id: lessonId },
    data: parsed,
  });

  revalidatePath(`/dashboard/courses/${courseId}/lessons/${lessonId}/edit`);
  revalidatePath(`/dashboard/learn/${courseId}/lessons/${lessonId}`);
}

export async function updateLessonVideoAction(
  courseId: string,
  lessonId: string,
  formData: FormData,
) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { section: { include: { course: true } } },
  });
  if (!lesson || lesson.section.courseId !== courseId) {
    throw new Error("Lesson not found.");
  }
  if (!canManageCourse(user, lesson.section.course)) {
    throw new Error("You do not have permission to manage this lesson.");
  }

  const parsed = lessonVideoSchema.parse({
    videoUrl: formData.get("videoUrl") ?? "",
    videoProvider: formData.get("videoProvider") ?? "EXTERNAL",
    videoAssetKey: formData.get("videoAssetKey") ?? "",
    videoMimeType: formData.get("videoMimeType") ?? "",
    videoBytes: formData.get("videoBytes") || undefined,
  });

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      videoUrl: parsed.videoUrl || null,
      videoProvider: parsed.videoUrl ? parsed.videoProvider : null,
      videoAssetKey: parsed.videoAssetKey || null,
      videoMimeType: parsed.videoMimeType || null,
      videoBytes:
        typeof parsed.videoBytes === "number" ? parsed.videoBytes : null,
    },
  });

  revalidatePath(`/dashboard/courses/${courseId}/lessons/${lessonId}/video`);
  revalidatePath(`/dashboard/learn/${courseId}/lessons/${lessonId}`);
}

export async function createAssessmentAction(
  courseId: string,
  formData: FormData,
) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!canManageCourse(user, course)) {
    throw new Error("You do not have permission to manage this course.");
  }

  const parsed = assessmentSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    prompt: formData.get("prompt"),
    options: formData.get("options"),
    correctIndex: formData.get("correctIndex"),
    passingScore: formData.get("passingScore"),
    requiredForCompletion: formData.get("requiredForCompletion") === "on",
  });
  const options = parseQuizOptions(parsed.options);
  if (parsed.correctIndex >= options.length) {
    throw new Error("Correct answer must match one of the provided options.");
  }

  await prisma.assessment.create({
    data: {
      courseId,
      title: parsed.title,
      description: parsed.description || null,
      passingScore: parsed.passingScore,
      requiredForCompletion: parsed.requiredForCompletion,
      questions: {
        create: {
          prompt: parsed.prompt,
          options,
          correctIndex: parsed.correctIndex,
        },
      },
    },
  });

  revalidatePath(`/dashboard/courses/${courseId}/assessments`);
  revalidatePath(`/dashboard/learn/${courseId}`);
}

export async function updateAssessmentAction(
  courseId: string,
  assessmentId: string,
  formData: FormData,
) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { course: true },
  });
  if (!assessment || assessment.courseId !== courseId) {
    throw new Error("Assessment not found.");
  }
  if (!canManageCourse(user, assessment.course)) {
    throw new Error("You do not have permission to manage this assessment.");
  }

  const parsed = assessmentSettingsSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    passingScore: formData.get("passingScore"),
    requiredForCompletion: formData.get("requiredForCompletion") === "on",
  });

  await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      title: parsed.title,
      description: parsed.description || null,
      passingScore: parsed.passingScore,
      requiredForCompletion: parsed.requiredForCompletion,
    },
  });

  revalidatePath(`/dashboard/courses/${courseId}/assessments`);
  revalidatePath(`/dashboard/courses/${courseId}/assessments/${assessmentId}`);
  revalidatePath(`/dashboard/learn/${courseId}`);
}

export async function deleteAssessmentAction(
  courseId: string,
  assessmentId: string,
) {
  const assessment = await requireManageableAssessment(courseId, assessmentId);

  await prisma.assessment.delete({ where: { id: assessment.id } });

  revalidatePath(`/dashboard/courses/${courseId}/assessments`);
  revalidatePath(`/dashboard/learn/${courseId}`);
}

export async function createAssessmentQuestionAction(
  courseId: string,
  assessmentId: string,
  formData: FormData,
) {
  const assessment = await requireManageableAssessment(courseId, assessmentId);
  const parsed = assessmentQuestionSchema.parse({
    prompt: formData.get("prompt"),
    options: formData.get("options"),
    correctIndex: formData.get("correctIndex"),
  });
  const options = parseQuizOptions(parsed.options);
  if (parsed.correctIndex >= options.length) {
    throw new Error("Correct answer must match one of the provided options.");
  }

  await prisma.assessmentQuestion.create({
    data: {
      assessmentId,
      prompt: parsed.prompt,
      options,
      correctIndex: parsed.correctIndex,
      position: assessment.questions.length,
    },
  });

  revalidatePath(`/dashboard/courses/${courseId}/assessments/${assessmentId}`);
  revalidatePath(`/dashboard/learn/${courseId}/assessments/${assessmentId}`);
}

export async function updateAssessmentQuestionAction(
  courseId: string,
  assessmentId: string,
  questionId: string,
  formData: FormData,
) {
  const assessment = await requireManageableAssessment(courseId, assessmentId);
  assertQuestionBelongsToAssessment(assessment, questionId);

  const parsed = assessmentQuestionSchema.parse({
    prompt: formData.get("prompt"),
    options: formData.get("options"),
    correctIndex: formData.get("correctIndex"),
  });
  const options = parseQuizOptions(parsed.options);
  if (parsed.correctIndex >= options.length) {
    throw new Error("Correct answer must match one of the provided options.");
  }

  await prisma.assessmentQuestion.update({
    where: { id: questionId },
    data: {
      prompt: parsed.prompt,
      options,
      correctIndex: parsed.correctIndex,
    },
  });

  revalidatePath(`/dashboard/courses/${courseId}/assessments/${assessmentId}`);
  revalidatePath(`/dashboard/learn/${courseId}/assessments/${assessmentId}`);
}

export async function moveAssessmentQuestionAction(
  courseId: string,
  assessmentId: string,
  questionId: string,
  direction: "up" | "down",
) {
  const assessment = await requireManageableAssessment(courseId, assessmentId);
  const currentIndex = assessment.questions.findIndex(
    (question) => question.id === questionId,
  );
  if (currentIndex === -1) throw new Error("Question not found.");

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= assessment.questions.length) return;

  const reordered = [...assessment.questions];
  const [question] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, question);

  await prisma.$transaction(
    reordered.map((item, position) =>
      prisma.assessmentQuestion.update({
        where: { id: item.id },
        data: { position },
      }),
    ),
  );

  revalidatePath(`/dashboard/courses/${courseId}/assessments/${assessmentId}`);
  revalidatePath(`/dashboard/learn/${courseId}/assessments/${assessmentId}`);
}

export async function deleteAssessmentQuestionAction(
  courseId: string,
  assessmentId: string,
  questionId: string,
  formData: FormData,
) {
  requireConfirmation(formData, "Confirm deleting this question first.");
  const assessment = await requireManageableAssessment(courseId, assessmentId);
  assertQuestionBelongsToAssessment(assessment, questionId);

  if (assessment.questions.length <= 1) {
    throw new Error("An assessment needs at least one question.");
  }

  const remainingQuestions = assessment.questions.filter(
    (question) => question.id !== questionId,
  );

  await prisma.$transaction([
    prisma.assessmentQuestion.delete({ where: { id: questionId } }),
    ...remainingQuestions.map((question, position) =>
      prisma.assessmentQuestion.update({
        where: { id: question.id },
        data: { position },
      }),
    ),
  ]);

  revalidatePath(`/dashboard/courses/${courseId}/assessments/${assessmentId}`);
  revalidatePath(`/dashboard/learn/${courseId}/assessments/${assessmentId}`);
}

export async function enrollCourseLearnerAction(
  courseId: string,
  formData: FormData,
) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!canManageCourse(user, course)) {
    throw new Error("You do not have permission to manage this course.");
  }

  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Choose a learner to enroll.");

  const learner = await prisma.user.findUnique({ where: { id: userId } });
  if (!learner) throw new Error("Learner not found.");

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, status: "ACTIVE" },
    update: { status: "ACTIVE" },
  });

  revalidatePath(`/dashboard/courses/${courseId}/students`);
  revalidatePath(`/dashboard/learn/${courseId}`);
  revalidatePath("/dashboard/my-courses");
}

async function requireManageableAssessment(
  courseId: string,
  assessmentId: string,
) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      course: true,
      questions: { orderBy: { position: "asc" } },
    },
  });
  if (!assessment || assessment.courseId !== courseId) {
    throw new Error("Assessment not found.");
  }
  if (!canManageCourse(user, assessment.course)) {
    throw new Error("You do not have permission to manage this assessment.");
  }

  return assessment;
}

function assertQuestionBelongsToAssessment(
  assessment: Awaited<ReturnType<typeof requireManageableAssessment>>,
  questionId: string,
) {
  if (!assessment.questions.some((question) => question.id === questionId)) {
    throw new Error("Question not found.");
  }
}

function requireConfirmation(formData: FormData, message: string) {
  if (formData.get("confirmDelete") !== "on") {
    throw new Error(message);
  }
}

export async function cancelCourseEnrollmentAction(
  courseId: string,
  userId: string,
) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!canManageCourse(user, course)) {
    throw new Error("You do not have permission to manage this course.");
  }

  await prisma.enrollment.update({
    where: { userId_courseId: { userId, courseId } },
    data: { status: "CANCELLED" },
  });

  revalidatePath(`/dashboard/courses/${courseId}/students`);
  revalidatePath(`/dashboard/learn/${courseId}`);
  revalidatePath("/dashboard/my-courses");
}

export async function submitAssessmentAction(
  courseId: string,
  assessmentId: string,
  formData: FormData,
) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { questions: true },
  });
  if (!assessment || assessment.courseId !== courseId) {
    throw new Error("Assessment not found.");
  }

  const answers = Object.fromEntries(
    assessment.questions.map((question) => [
      question.id,
      Number(formData.get(`question-${question.id}`)),
    ]),
  );
  const score = scoreQuiz(assessment.questions, answers);
  const passed = score >= assessment.passingScore;

  await prisma.assessmentSubmission.create({
    data: {
      assessmentId,
      userId: user.id,
      answers,
      score,
      passed,
    },
  });

  revalidatePath(`/dashboard/learn/${courseId}/assessments/${assessmentId}`);
  revalidatePath(`/dashboard/learn/${courseId}`);
}

export async function updateProfileAction(formData: FormData) {
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const parsed = profileSchema.parse({
    name: formData.get("name"),
    websiteUrl: formData.get("websiteUrl"),
    bio: formData.get("bio"),
  });

  await prisma.user.update({
    where: { id: user.id },
    data: parsed,
  });

  revalidatePath("/dashboard/settings");
}

export async function markLessonCompleteAction(
  lessonId: string,
  _formData?: FormData,
) {
  void _formData;
  assertDatabaseConfigured();

  const user = await requireAppUser();
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { section: { include: { course: true } } },
  });
  if (!lesson) throw new Error("Lesson not found.");

  const canManage = canManageCourse(user, lesson.section.course);
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: user.id,
        courseId: lesson.section.courseId,
      },
    },
  });

  if (!canManage && !enrollment) {
    throw new Error("You must be enrolled to complete this lesson.");
  }

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    create: {
      userId: user.id,
      lessonId,
      completedAt: new Date(),
    },
    update: {
      completedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  revalidatePath(`/dashboard/learn/${lesson.section.courseId}`);
  revalidatePath(
    `/dashboard/learn/${lesson.section.courseId}/lessons/${lessonId}`,
  );
}

function assertDatabaseConfigured() {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    throw new Error(
      "Supabase is not configured. Add DATABASE_URL to .env.local.",
    );
  }
}

async function uniqueCourseSlug(baseSlug: string) {
  const normalized = slugify(baseSlug) || `imported-course-${Date.now()}`;
  const existing = await prisma.course.findUnique({
    where: { slug: normalized },
  });
  if (!existing) return normalized;
  return `${normalized}-import-${Date.now()}`;
}

async function runAction(
  operation: () => Promise<void>,
  successMessage: string,
): Promise<ActionFormState> {
  try {
    await operation();
    return actionSuccess(successMessage);
  } catch (error) {
    return actionError(error);
  }
}
