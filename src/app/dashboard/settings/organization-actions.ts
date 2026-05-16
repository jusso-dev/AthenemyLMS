"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  invitationSchema,
  organizationMemberIdSchema,
  organizationMemberSchema,
  organizationSchema,
} from "@/lib/course-schemas";
import { env, missingEnv } from "@/lib/env";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  acceptInvitation,
  canManageOrganization,
  createInvitationToken,
  createOrganizationForUser,
  hasOrgRole,
  type OrgRole,
} from "@/lib/organizations";
import {
  actionError,
  actionSuccess,
  type ActionFormState,
} from "@/lib/action-state";

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

export async function createOrganizationFormAction(
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => createOrganizationAction(formData),
    "Organisation created.",
  );
}

export async function createOnboardingOrganizationAction(formData: FormData) {
  assertDatabase();
  const user = await requireAppUser();
  const membershipCount = await prisma.organizationMembership.count({
    where: { userId: user.id },
  });
  if (membershipCount > 0) {
    redirect("/dashboard");
  }

  const parsed = organizationSchema.parse({
    name: formData.get("name"),
    supportEmail: formData.get("supportEmail") ?? "",
  });

  await createOrganizationForUser({
    name: parsed.name,
    supportEmail: parsed.supportEmail || user.email,
    userId: user.id,
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
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

  const token = createInvitationToken();
  const invitation = await prisma.organizationInvitation.create({
    data: {
      organizationId: parsed.organizationId,
      email: parsed.email,
      role: parsed.role,
      token,
      invitedById: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    },
  });

  try {
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress: parsed.email,
      expiresInDays: 14,
      ignoreExisting: true,
      notify: true,
      redirectUrl: `${env.NEXT_PUBLIC_APP_URL}/invitations/${token}`,
      publicMetadata: {
        organizationId: parsed.organizationId,
        organizationInvitationId: invitation.id,
      },
    });
  } catch (error) {
    await prisma.organizationInvitation
      .delete({ where: { id: invitation.id } })
      .catch(() => undefined);
    throw error;
  }

  revalidatePath("/dashboard/settings");
}

export async function inviteOrganizationMemberFormAction(
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => inviteOrganizationMemberAction(formData),
    "Invitation sent.",
  );
}

export async function updateOrganizationMemberAction(formData: FormData) {
  assertDatabase();
  const user = await requireAppUser();
  const parsed = organizationMemberSchema.parse({
    organizationId: formData.get("organizationId"),
    membershipId: formData.get("membershipId"),
    name: formData.get("name") ?? "",
    appRole: formData.get("appRole"),
    orgRole: formData.get("orgRole"),
  });
  const { actorMembership, targetMembership } = await requireManageableMember(
    user,
    parsed.organizationId,
    parsed.membershipId,
  );

  if (
    targetMembership.role === "OWNER" &&
    parsed.orgRole !== "OWNER" &&
    (await ownerCount(parsed.organizationId)) <= 1
  ) {
    throw new Error("Every organisation needs at least one owner.");
  }
  if (!canAssignOrgRole(user.role, actorMembership?.role, parsed.orgRole)) {
    throw new Error(
      "You do not have permission to assign that organisation role.",
    );
  }

  const name = parsed.name?.trim() || null;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetMembership.userId },
      data: {
        name,
        role: parsed.appRole,
      },
    }),
    prisma.organizationMembership.update({
      where: { id: targetMembership.id },
      data: { role: parsed.orgRole },
    }),
  ]);

  if (name) {
    const [firstName, ...lastNameParts] = name.split(/\s+/);
    const client = await clerkClient();
    await client.users.updateUser(targetMembership.user.clerkId, {
      firstName,
      lastName: lastNameParts.join(" ") || undefined,
    });
  }

  revalidatePath("/dashboard/settings");
}

export async function updateOrganizationMemberFormAction(
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => updateOrganizationMemberAction(formData),
    "Member updated.",
  );
}

export async function requirePasswordResetAction(formData: FormData) {
  assertDatabase();
  const user = await requireAppUser();
  const parsed = organizationMemberIdSchema.parse({
    organizationId: formData.get("organizationId"),
    membershipId: formData.get("membershipId"),
  });
  const { targetMembership } = await requireManageableMember(
    user,
    parsed.organizationId,
    parsed.membershipId,
  );

  const client = await clerkClient();
  await client.users.setPasswordCompromised(targetMembership.user.clerkId, {
    revokeAllSessions: true,
  });

  revalidatePath("/dashboard/settings");
}

export async function requirePasswordResetFormAction(
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => requirePasswordResetAction(formData),
    "Password reset required.",
  );
}

export async function deleteOrganizationMemberAction(formData: FormData) {
  assertDatabase();
  const user = await requireAppUser();
  const parsed = organizationMemberIdSchema.parse({
    organizationId: formData.get("organizationId"),
    membershipId: formData.get("membershipId"),
  });
  const { targetMembership } = await requireManageableMember(
    user,
    parsed.organizationId,
    parsed.membershipId,
  );

  if (targetMembership.userId === user.id) {
    throw new Error(
      "You cannot delete your own account from organisation settings.",
    );
  }
  if (
    targetMembership.role === "OWNER" &&
    (await ownerCount(parsed.organizationId)) <= 1
  ) {
    throw new Error("Every organisation needs at least one owner.");
  }

  const client = await clerkClient();
  await client.users.deleteUser(targetMembership.user.clerkId);
  await prisma.user.delete({ where: { id: targetMembership.userId } });

  revalidatePath("/dashboard/settings");
}

export async function deleteOrganizationMemberFormAction(
  _previousState: ActionFormState,
  formData: FormData,
) {
  return runAction(
    () => deleteOrganizationMemberAction(formData),
    "User deleted.",
  );
}

export async function acceptInvitationAction(token: string) {
  assertDatabase();
  const user = await requireAppUser();
  await acceptInvitation({ token, userId: user.id, email: user.email });
  redirect("/dashboard/settings");
}

function assertDatabase() {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    throw new Error(
      "Supabase is not configured. Add DATABASE_URL to .env.local.",
    );
  }
}

async function requireManageableMember(
  user: Awaited<ReturnType<typeof requireAppUser>>,
  organizationId: string,
  membershipId: string,
) {
  const [actorMembership, targetMembership] = await Promise.all([
    prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
    }),
    prisma.organizationMembership.findUnique({
      where: { id: membershipId },
      include: { user: true },
    }),
  ]);

  if (!canManageOrganization(user, actorMembership)) {
    throw new Error("Organisation admin access is required.");
  }
  if (!targetMembership || targetMembership.organizationId !== organizationId) {
    throw new Error("Organisation member not found.");
  }
  if (
    !canManageTarget(user.role, actorMembership?.role, targetMembership.role)
  ) {
    throw new Error("You do not have permission to manage this member.");
  }

  return { actorMembership, targetMembership };
}

function canManageTarget(
  appRole: string,
  actorRole: OrgRole | undefined,
  targetRole: OrgRole,
) {
  if (appRole === "ADMIN") return true;
  if (actorRole === "OWNER") return true;
  return actorRole === "ADMIN" && targetRole !== "OWNER";
}

function canAssignOrgRole(
  appRole: string,
  actorRole: OrgRole | undefined,
  targetRole: OrgRole,
) {
  if (appRole === "ADMIN") return true;
  if (actorRole === "OWNER") return true;
  return actorRole === "ADMIN" && hasOrgRole("ADMIN", targetRole);
}

function ownerCount(organizationId: string) {
  return prisma.organizationMembership.count({
    where: { organizationId, role: "OWNER" },
  });
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
