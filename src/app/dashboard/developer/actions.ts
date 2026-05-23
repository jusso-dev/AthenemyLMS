"use server";

import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  type ActionFormState,
} from "@/lib/action-state";
import { requireAppUser } from "@/lib/auth";
import { createOrganizationApiKey, isApiScope } from "@/lib/developer/api-keys";
import {
  createWebhookEndpoint,
  webhookEventTypes,
} from "@/lib/developer/webhooks";
import { missingEnv } from "@/lib/env";
import { canManageOrganization } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";

export async function createApiKeyFormAction(
  _previousState: ActionFormState,
  formData: FormData,
) {
  try {
    assertDatabase();
    const user = await requireAppUser();
    const organizationId = String(formData.get("organizationId") ?? "");
    await requireDeveloperAccess(user, organizationId);
    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 2) throw new Error("API key name is required.");
    const scopes = formData.getAll("scopes").map(String).filter(isApiScope);
    const { rawKey } = await createOrganizationApiKey({
      organizationId,
      name,
      scopes: scopes.length > 0 ? scopes : ["org:read"],
      createdById: user.id,
    });
    revalidatePath("/dashboard/developer");
    return actionSuccess(`API key created. Copy it now: ${rawKey}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createWebhookEndpointFormAction(
  _previousState: ActionFormState,
  formData: FormData,
) {
  try {
    assertDatabase();
    const user = await requireAppUser();
    const organizationId = String(formData.get("organizationId") ?? "");
    await requireDeveloperAccess(user, organizationId);
    const url = String(formData.get("url") ?? "").trim();
    const eventTypes = formData
      .getAll("eventTypes")
      .map(String)
      .filter((eventType) =>
        webhookEventTypes.includes(
          eventType as (typeof webhookEventTypes)[number],
        ),
      );
    const { secret } = await createWebhookEndpoint({
      organizationId,
      url,
      eventTypes,
      createdById: user.id,
    });
    revalidatePath("/dashboard/developer");
    return actionSuccess(`Webhook endpoint created. Copy it now: ${secret}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function revokeApiKeyFormAction(
  _previousState: ActionFormState,
  formData: FormData,
) {
  try {
    assertDatabase();
    const user = await requireAppUser();
    const apiKeyId = String(formData.get("apiKeyId") ?? "");
    if (!apiKeyId) throw new Error("API key id is required.");
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { id: true, organizationId: true, revokedAt: true },
    });
    if (!apiKey) throw new Error("API key not found.");
    await requireDeveloperAccess(user, apiKey.organizationId);
    if (apiKey.revokedAt) {
      return actionSuccess("API key was already revoked.");
    }
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { revokedAt: new Date() },
    });
    revalidatePath("/dashboard/developer");
    return actionSuccess("API key revoked.");
  } catch (error) {
    return actionError(error);
  }
}

function assertDatabase() {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    throw new Error("Supabase is not configured. Add DATABASE_URL.");
  }
}

async function requireDeveloperAccess(
  user: Awaited<ReturnType<typeof requireAppUser>>,
  organizationId: string,
) {
  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: user.id,
      },
    },
  });
  if (!canManageOrganization(user, membership)) {
    throw new Error("Organisation admin access is required.");
  }
}
