import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OrgRole } from "@/lib/organizations";

export const capabilityPresets = {
  owner: [
    "organization.manage",
    "members.manage",
    "courses.manage",
    "billing.manage",
    "developer.manage",
    "audit.read",
  ],
  admin: ["members.manage", "courses.manage", "developer.manage", "audit.read"],
  instructor: ["courses.manage", "cohorts.manage", "discussions.moderate"],
  member: ["learning.access", "discussions.post"],
} as const;

export function capabilitiesForOrgRole(role: OrgRole) {
  switch (role) {
    case "OWNER":
      return [...capabilityPresets.owner];
    case "ADMIN":
      return [...capabilityPresets.admin];
    case "INSTRUCTOR":
      return [...capabilityPresets.instructor];
    case "MEMBER":
      return [...capabilityPresets.member];
  }
}

export function roleHasCapability(
  role: OrgRole | undefined,
  capability: string,
) {
  if (!role) return false;
  return (capabilitiesForOrgRole(role) as string[]).includes(capability);
}

export async function recordAuditLog(input: {
  organizationId?: string | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      organizationId: input.organizationId ?? null,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      severity: input.severity ?? "INFO",
      metadata: (input.metadata ?? {}) as Prisma.InputJsonObject,
    },
  });
}

export async function ensurePrivacySettings(organizationId: string) {
  return prisma.organizationPrivacySettings.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId },
  });
}
