"use server";

import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { learningTransaction } from "@/lib/learning";
import { canManageCourse } from "@/lib/permissions";
import {
  actionError,
  actionSuccess,
  type ActionFormState,
} from "@/lib/action-state";
import { prepareScorm12Package, SCORM_LIMITS } from "@/lib/scorm";
import { storeScormAssets, removeScormAssets } from "@/lib/scorm-storage";

export async function uploadScormPackageFormAction(
  courseId: string,
  _state: ActionFormState,
  formData: FormData,
) {
  try {
    await uploadScormPackageAction(courseId, formData);
    return actionSuccess("SCORM package imported and ready to launch.");
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadScormPackageAction(
  courseId: string,
  formData: FormData,
) {
  const user = await requireAppUser();
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || !canManageCourse(user, course))
    throw new Error("You do not have permission to manage this course.");
  const lessonId = String(formData.get("lessonId") ?? "");
  if (
    lessonId &&
    !(await prisma.lesson.findFirst({
      where: { id: lessonId, section: { courseId } },
      select: { id: true },
    }))
  ) {
    throw new Error("Choose a lesson from this course.");
  }
  const file = formData.get("packageFile");
  if (
    !(file instanceof File) ||
    !file.size ||
    !file.name.toLowerCase().endsWith(".zip")
  )
    throw new Error("Upload a SCORM 1.2 .zip package.");
  if (file.size > SCORM_LIMITS.compressedBytes)
    throw new Error("SCORM ZIP files must be 20 MB or smaller.");
  const { manifest, assets } = await prepareScorm12Package(
    await file.arrayBuffer(),
  );
  const storageKey = await storeScormAssets(assets);
  try {
    await learningTransaction(async (database) => {
      await database.externalPackage.create({
        data: {
          organizationId: course.organizationId,
          courseId,
          lessonId: lessonId || null,
          uploadedById: user.id,
          type: "SCORM_12",
          status: "READY",
          title: manifest.title,
          identifier: manifest.identifier,
          version: manifest.version,
          launchPath: manifest.launchPath,
          storageKey,
          manifest,
          validationLog: `${assets.size} assets validated and stored privately.`,
        },
      });
      if (lessonId)
        await database.enrollment.updateMany({
          where: { courseId, status: "COMPLETED" },
          data: { status: "ACTIVE" },
        });
    });
  } catch (error) {
    await removeScormAssets(storageKey);
    throw error;
  }
  revalidatePath(`/dashboard/courses/${courseId}/interoperability`);
  revalidatePath(`/dashboard/learn/${courseId}`);
}
