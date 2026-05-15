"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invitationSchema, organizationSchema } from "@/lib/course-schemas";
import { missingEnv } from "@/lib/env";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  acceptInvitation,
  canManageOrganization,
  createInvitationToken,
  createOrganizationForUser,
} from "@/lib/organizations";

export async function createOrganizationAction(formData: FormData) {
  assertDatabase();
  const user = await requireAppUser();
  const parsed = organizationSchema.parse({
    name: formData.get("name"),
    supportEmail: formData.get("supportEmail") ?? "",
  });

  await createOrganizationForUser({
    name: parsed.name,
    supportEmail: parsed.supportEmail || undefined,
    userId: user.id,
  });

  revalidatePath("/dashboard/settings");
}

export async function inviteOrganizationMemberAction(formData: FormData) {
  assertDatabase();
  const user = await requireAppUser();
  const parsed = invitationSchema.parse({
    organizationId: formData.get("organizationId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: parsed.organizationId,
        userId: user.id,
      },
    },
  });
  if (!canManageOrganization(user, membership)) {
    throw new Error("Organisation admin access is required.");
  }

  await prisma.organizationInvitation.create({
    data: {
      organizationId: parsed.organizationId,
      email: parsed.email,
      role: parsed.role,
      token: createInvitationToken(),
      invitedById: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    },
  });

  revalidatePath("/dashboard/settings");
}

export async function acceptInvitationAction(token: string) {
  assertDatabase();
  const user = await requireAppUser();
  await acceptInvitation({ token, userId: user.id, email: user.email });
  redirect("/dashboard/settings");
}

function assertDatabase() {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    throw new Error("Supabase is not configured. Add DATABASE_URL to .env.local.");
  }
}
