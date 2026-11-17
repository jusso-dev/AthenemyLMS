export type Role = "STUDENT" | "INSTRUCTOR" | "ADMIN";

/** Platform administration is an operator grant, never a side effect of tenant ownership. */
export function resolvePlatformRole(
  storedRole: Role,
  clerkId: string,
  administratorIds = "",
): Role {
  const trustedIds = administratorIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (trustedIds.includes(clerkId)) return "ADMIN";
  // Older releases promoted organisation creators in the database. Fail closed for those rows.
  return storedRole === "ADMIN" ? "STUDENT" : storedRole;
}

const roleRank: Record<Role, number> = {
  STUDENT: 0,
  INSTRUCTOR: 1,
  ADMIN: 2,
};

type PermissionUser = {
  id: string;
  role: Role;
  organizationMemberships?: {
    organizationId: string;
    role: "OWNER" | "ADMIN" | "INSTRUCTOR" | "MEMBER";
  }[];
};

export function authorableOrganizationIds(user: PermissionUser) {
  return (user.organizationMemberships ?? [])
    .filter((membership) => membership.role !== "MEMBER")
    .map((membership) => membership.organizationId);
}

export function managedOrganizationIds(user: PermissionUser) {
  return (user.organizationMemberships ?? [])
    .filter((membership) => ["OWNER", "ADMIN"].includes(membership.role))
    .map((membership) => membership.organizationId);
}

export function canAuthorCourses(user: PermissionUser | null | undefined) {
  return Boolean(
    user &&
    (hasRole(user.role, "INSTRUCTOR") ||
      authorableOrganizationIds(user).length),
  );
}

export function hasRole(userRole: Role | undefined, minimumRole: Role) {
  if (!userRole) return false;
  return roleRank[userRole] >= roleRank[minimumRole];
}

export function canManageCourse(
  user: PermissionUser | null,
  course: { instructorId: string; organizationId?: string | null } | null,
) {
  if (!user || !course) return false;
  if (user.role === "ADMIN") return true;
  if (course.organizationId) {
    return (
      managedOrganizationIds(user).includes(course.organizationId) ||
      (course.instructorId === user.id &&
        authorableOrganizationIds(user).includes(course.organizationId))
    );
  }
  return course.instructorId === user.id;
}

export function canAccessAdmin(userRole: Role | undefined) {
  return userRole === "ADMIN";
}
