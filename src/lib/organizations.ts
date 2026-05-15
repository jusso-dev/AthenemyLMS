import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import type { Role } from "@/lib/permissions";

export type OrgRole = "OWNER" | "ADMIN" | "INSTRUCTOR" | "MEMBER";

const orgRoleRank: Record<OrgRole, number> = {
  MEMBER: 0,
  INSTRUCTOR: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function createInvitationToken(entropy = crypto.randomUUID()) {
  return entropy.replaceAll("-", "");
}

export function hasOrgRole(role: OrgRole | undefined, minimumRole: OrgRole) {
  if (!role) return false;
  return orgRoleRank[role] >= orgRoleRank[minimumRole];
}

export function canManageOrganization(
  user: { id: string; role: Role } | null,
  membership: { role: OrgRole } | null,
) {
  if (!user) return false;
  return user.role === "ADMIN" || hasOrgRole(membership?.role, "ADMIN");
}

export async function createOrganizationForUser(input: {
  name: string;
  supportEmail?: string;
  userId: string;
}) {
  const baseSlug = slugify(input.name);
  const slug = `${baseSlug}-${createInvitationToken().slice(0, 6)}`;

  return prisma.organization.create({
    data: {
      name: input.name,
      slug,
      supportEmail: input.supportEmail || null,
      memberships: {
        create: { userId: input.userId, role: "OWNER" },
      },
    },
  });
}

export async function acceptInvitation(input: {
  token: string;
  userId: string;
  email: string;
}) {
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token: input.token },
  });

  if (!invitation || invitation.status !== "PENDING") {
    throw new Error("Invitation is no longer available.");
  }
  if (invitation.expiresAt < new Date()) {
    throw new Error("Invitation has expired.");
  }
  if (invitation.email.toLowerCase() !== input.email.toLowerCase()) {
    throw new Error("Invitation email does not match the signed-in user.");
  }

  await prisma.$transaction([
    prisma.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: input.userId,
        },
      },
      update: { role: invitation.role },
      create: {
        organizationId: invitation.organizationId,
        userId: input.userId,
        role: invitation.role,
      },
    }),
    prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    }),
  ]);
}
