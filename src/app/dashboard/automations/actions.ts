"use server";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  type ActionFormState,
} from "@/lib/action-state";
import { requireAppUser } from "@/lib/auth";
import { builtInAutomationRecipes } from "@/lib/automations/events";
import { canManageOrganization } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";

export async function saveAutomationRecipeAction(
  _previous: ActionFormState,
  formData: FormData,
) {
  try {
    const user = await requireAppUser();
    const organizationId = String(formData.get("organizationId") ?? "");
    const membership = await prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (!canManageOrganization(user, membership))
      throw new Error("Organisation admin access is required.");
    const recipe = builtInAutomationRecipes.find(
      (item) => item.actionType === formData.get("actionType"),
    );
    if (!recipe) throw new Error("Unknown recipe.");
    const enabled = formData.get("enabled") === "true";
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;
      const existing = await tx.automationRule.findFirst({
        where: {
          organizationId,
          actionType: recipe.actionType,
          eventType: recipe.eventType,
        },
      });
      if (existing)
        await tx.automationRule.update({
          where: { id: existing.id },
          data: { enabled },
        });
      else
        await tx.automationRule.create({
          data: { organizationId, ...recipe, enabled, createdById: user.id },
        });
    });
    revalidatePath("/dashboard/automations");
    return actionSuccess(enabled ? "Recipe enabled." : "Recipe paused.");
  } catch (error) {
    return actionError(error);
  }
}
