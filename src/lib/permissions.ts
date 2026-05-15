export type Role = "STUDENT" | "INSTRUCTOR" | "ADMIN";

const roleRank: Record<Role, number> = {
  STUDENT: 0,
  INSTRUCTOR: 1,
  ADMIN: 2,
};

export function hasRole(userRole: Role | undefined, minimumRole: Role) {
  if (!userRole) return false;
  return roleRank[userRole] >= roleRank[minimumRole];
}

export function canManageCourse(
  user: { id: string; role: Role } | null,
  course: { instructorId: string } | null,
) {
  if (!user || !course) return false;
  return user.role === "ADMIN" || course.instructorId === user.id;
}

export function canAccessAdmin(userRole: Role | undefined) {
  return userRole === "ADMIN";
}
