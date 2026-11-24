import type { User } from "@/features/auth/types";
import type { Project } from "./types";

export function getProjectPermissions(project: Project, user: User | null) {
  const isAdmin = Boolean(user?.roles.includes("ADMIN"));
  const isMember =
    project.canManage ||
    project.myRole != null ||
    (user?.id != null && project.teamIds.includes(user.id));
  const writable = !project.archived;

  return {
    canEditTasks: writable && isMember,
    canDeleteTasks: writable && project.canManage,
    canManageColumns: writable && project.canManage,
    canCollaborate: writable && isMember,
    canEditSkillsOf: (userId: number) => user?.id === userId || isAdmin,
  };
}

export type ProjectPermissions = ReturnType<typeof getProjectPermissions>;
