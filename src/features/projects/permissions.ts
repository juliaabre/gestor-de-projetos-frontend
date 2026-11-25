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
    /** Decidir sobre recomendações de responsável (RF10) é papel do gerente. */
    canDecideAssignment: writable && project.canManage,
    canCollaborate: writable && isMember,
    canEditSkillsOf: (userId: number) => user?.id === userId || isAdmin,
  };
}

export type ProjectPermissions = ReturnType<typeof getProjectPermissions>;
