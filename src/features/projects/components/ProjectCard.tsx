import { Archive, ArchiveRestore, LoaderCircle, Pencil } from "lucide-react";
import util from "@/lib/util.json";
import type { Project } from "../types";
import { Avatar } from "./Avatar";

const t = util.projects.card;
const MAX_AVATARS = 5;

export function ProjectCard({
  project,
  onEdit,
  onArchive,
  onUnarchive,
  unarchiving = false,
}: {
  project: Project;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  unarchiving?: boolean;
}) {
  const team = project.team;
  const hiddenCount = team.length - MAX_AVATARS;
  const roleLabel =
    project.myRole === "MANAGER" ? t.roleManager : project.myRole === "MEMBER" ? t.roleMember : null;

  return (
    <article
      aria-labelledby={`project-${project.id}-name`}
      className={`flex flex-col rounded-2xl border bg-white p-5 ${
        project.archived ? "border-slate-200 bg-slate-50/60" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={`project-${project.id}-name`} className="min-w-0 break-words text-base font-semibold text-slate-900">
          {project.name}
        </h3>
        <div className="flex shrink-0 gap-1.5">
          {project.archived && (
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              {t.archivedBadge}
            </span>
          )}
          {roleLabel && (
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              {roleLabel}
            </span>
          )}
        </div>
      </div>

      <p
        className={`mt-2 line-clamp-3 text-sm leading-6 ${
          project.description ? "text-slate-600" : "italic text-slate-400"
        }`}
      >
        {project.description || t.noDescription}
      </p>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {t.team} · {team.length}
        </p>
        {team.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">{t.noTeam}</p>
        ) : (
          <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2" aria-label={t.team}>
            {team.slice(0, MAX_AVATARS).map((member) => (
              <li key={member.id} className="flex items-center gap-1.5 text-sm text-slate-700" title={member.email}>
                <Avatar name={member.username} className="size-6 text-[10px]" />
                <span>
                  {member.username}
                  {member.id === project.creatorId && (
                    <span className="text-slate-400"> ({t.creator})</span>
                  )}
                </span>
              </li>
            ))}
            {hiddenCount > 0 && (
              <li
                className="text-sm text-slate-500"
                title={team.slice(MAX_AVATARS).map((member) => member.username).join(", ")}
              >
                +{hiddenCount}
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <p className="text-xs text-slate-500">
          {t.tasks.replace("{count}", String(project.taskIds.length))}
          {project.createdAt && (
            <>
              {" · "}
              {t.createdAt.replace(
                "{date}",
                new Date(project.createdAt).toLocaleDateString("pt-BR"),
              )}
            </>
          )}
        </p>

        {project.canManage && (
          <div className="flex gap-2" role="group" aria-label={t.actions.replace("{name}", project.name)}>
            {project.archived ? (
              <button
                type="button"
                onClick={onUnarchive}
                disabled={unarchiving}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {unarchiving ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <ArchiveRestore className="size-4" />
                )}
                {t.unarchive}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Pencil className="size-4" /> {t.edit}
                </button>
                <button
                  type="button"
                  onClick={onArchive}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 px-3 text-sm font-medium text-amber-800 hover:bg-amber-50"
                >
                  <Archive className="size-4" /> {t.archive}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
