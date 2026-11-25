import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FeedbackBanner, useFeedback } from "@/components/FeedbackBanner";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { inputClass, smallButtonClass } from "@/components/ui";
import { getErrorMessage, isUnavailable } from "@/lib/apiError";
import { fillTemplate } from "@/lib/format";
import util from "@/lib/util.json";
import { Avatar } from "@/features/projects/components/Avatar";
import type { ProjectPermissions } from "@/features/projects/permissions";
import type { Project, TeamMember } from "@/features/projects/types";
import { deleteSkill, listUserSkills } from "../services/skillService";
import { ACTIVITY_TYPES, EXPERIENCE_LEVELS, labelOf, type Skill } from "../types";
import { SkillFormModal } from "./SkillFormModal";

const t = util.skills;

type MemberSkills =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; skills: Skill[] };

type PanelState = { unavailable: boolean; byMember: Record<number, MemberSkills> };

const LEVEL_STYLE: Record<string, string> = {
  INICIANTE: "bg-slate-100 text-slate-700",
  INTERMEDIARIO: "bg-blue-50 text-blue-700",
  AVANCADO: "bg-emerald-50 text-emerald-700",
  ESPECIALISTA: "bg-violet-50 text-violet-700",
};

export function TeamPanel({
  project,
  currentUserId,
  permissions,
}: {
  project: Project;
  currentUserId?: number;
  permissions: ProjectPermissions;
}) {
  const team = project.team;
  const [state, setState] = useState<PanelState>({ unavailable: false, byMember: {} });
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<{ member: TeamMember; skill?: Skill } | null>(null);
  const [toDelete, setToDelete] = useState<{ member: TeamMember; skill: Skill } | null>(null);
  const { feedback, success, clear } = useFeedback();

  const loadMember = useCallback(async (memberId: number): Promise<MemberSkills | "unavailable"> => {
    try {
      return { status: "success", skills: await listUserSkills(memberId) };
    } catch (error) {
      if (isUnavailable(error)) return "unavailable";
      return { status: "error", message: getErrorMessage(error, t.loadError) };
    }
  }, []);

  const loadAll = useCallback(() => {
    let active = true;
    setState({
      unavailable: false,
      byMember: Object.fromEntries(team.map((m) => [m.id, { status: "loading" }])),
    });
    Promise.all(team.map((m) => loadMember(m.id))).then((results) => {
      if (!active) return;
      const unavailable = results.length > 0 && results.every((r) => r === "unavailable");
      setState({
        unavailable,
        byMember: Object.fromEntries(
          team.map((m, i) => {
            const result = results[i];
            return [
              m.id,
              result === "unavailable" ? { status: "success", skills: [] } : result,
            ];
          }),
        ),
      });
    });
    return () => {
      active = false;
    };
  }, [team, loadMember]);

  useEffect(loadAll, [loadAll]);

  const retryMember = async (memberId: number) => {
    setState((prev) => ({ ...prev, byMember: { ...prev.byMember, [memberId]: { status: "loading" } } }));
    const result = await loadMember(memberId);
    setState((prev) => ({
      ...prev,
      byMember: {
        ...prev.byMember,
        [memberId]: result === "unavailable" ? { status: "success", skills: [] } : result,
      },
    }));
  };

  const updateSkills = (memberId: number, fn: (skills: Skill[]) => Skill[]) =>
    setState((prev) => {
      const current = prev.byMember[memberId];
      const skills = current?.status === "success" ? current.skills : [];
      return { ...prev, byMember: { ...prev.byMember, [memberId]: { status: "success", skills: fn(skills) } } };
    });

  const sortedTeam = useMemo(
    () =>
      [...team].sort((a, b) => {
        if (a.id === currentUserId) return -1;
        if (b.id === currentUserId) return 1;
        return a.username.localeCompare(b.username, "pt-BR");
      }),
    [team, currentUserId],
  );

  const query = search.trim().toLowerCase();
  const visibleTeam = sortedTeam.filter((member) => {
    if (!query) return true;
    if (member.username.toLowerCase().includes(query) || member.email.toLowerCase().includes(query)) return true;
    const entry = state.byMember[member.id];
    return (
      entry?.status === "success" &&
      entry.skills.some(
        (skill) =>
          skill.technologies.some((tech) => tech.toLowerCase().includes(query)) ||
          labelOf(ACTIVITY_TYPES, skill.activityType).toLowerCase().includes(query),
      )
    );
  });

  if (team.length === 0) {
    return <EmptyState title={t.emptyTeam} description={t.emptyTeamDescription} icon={<Users className="mx-auto text-slate-300" />} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <FeedbackBanner feedback={feedback} onClose={clear} />

      {state.unavailable && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t.unavailable}
        </p>
      )}

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.search}
          aria-label={t.search}
          className={`${inputClass} h-10 pl-9 text-sm`}
        />
      </div>

      {visibleTeam.length === 0 ? (
        <EmptyState title={t.noResults} compact />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={t.title}>
          {visibleTeam.map((member) => {
            const entry = state.byMember[member.id] ?? { status: "loading" };
            const canEdit = !state.unavailable && permissions.canEditSkillsOf(member.id);
            return (
              <li key={member.id}>
                <article
                  aria-labelledby={`member-${member.id}`}
                  className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={member.username} className="size-10 text-sm" />
                    <div className="min-w-0 flex-1">
                      <h2 id={`member-${member.id}`} className="truncate font-semibold text-slate-900">
                        {member.username}
                        {member.id === currentUserId && (
                          <span className="font-normal text-slate-500"> ({t.you})</span>
                        )}
                      </h2>
                      <p className="truncate text-xs text-slate-500">{member.email}</p>
                    </div>
                    {member.id === project.creatorId && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {t.creator}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t.skills}</p>
                    {entry.status === "loading" && <LoadingState label={t.loading} compact />}
                    {entry.status === "error" && (
                      <div className="mt-2">
                        <ErrorState title={t.loadError} message={entry.message} onRetry={() => retryMember(member.id)} compact />
                      </div>
                    )}
                    {entry.status === "success" && entry.skills.length === 0 && (
                      <p className="mt-2 text-sm italic text-slate-500">{t.noSkills}</p>
                    )}
                    {entry.status === "success" && entry.skills.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-2" aria-label={fillTemplate(t.skillsOf, { name: member.username })}>
                        {entry.skills.map((skill) => (
                          <li key={skill.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800">
                                  {labelOf(ACTIVITY_TYPES, skill.activityType)}
                                </p>
                                <span
                                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                    LEVEL_STYLE[skill.level] ?? "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {labelOf(EXPERIENCE_LEVELS, skill.level)}
                                </span>
                              </div>
                              {canEdit && (
                                <div className="flex shrink-0 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setForm({ member, skill })}
                                    aria-label={fillTemplate(t.edit, { name: labelOf(ACTIVITY_TYPES, skill.activityType) })}
                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-700"
                                  >
                                    <Pencil className="size-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setToDelete({ member, skill })}
                                    aria-label={fillTemplate(t.remove, { name: labelOf(ACTIVITY_TYPES, skill.activityType) })}
                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-red-700"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                            {skill.technologies.length > 0 && (
                              <ul className="mt-2 flex flex-wrap gap-1" aria-label={t.technologies}>
                                {skill.technologies.map((tech) => (
                                  <li key={tech} className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
                                    {tech}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {canEdit && entry.status === "success" && (
                    <button type="button" onClick={() => setForm({ member })} className={`${smallButtonClass} mt-4 w-fit`}>
                      <Plus className="size-4" /> {t.add}
                    </button>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {form && (
        <SkillFormModal
          userId={form.member.id}
          skill={form.skill}
          onClose={() => setForm(null)}
          onSaved={(saved, mode) => {
            const memberId = form.member.id;
            setForm(null);
            updateSkills(memberId, (skills) =>
              mode === "created" ? [...skills, saved] : skills.map((s) => (s.id === saved.id ? saved : s)),
            );
            success(mode === "created" ? t.feedback.created : t.feedback.updated);
          }}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title={t.deleteDialog.title}
          description={fillTemplate(t.deleteDialog.description, {
            name: labelOf(ACTIVITY_TYPES, toDelete.skill.activityType),
          })}
          confirmLabel={t.deleteDialog.confirm}
          confirmingLabel={t.deleteDialog.confirming}
          getError={(error) => getErrorMessage(error, t.deleteDialog.error)}
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            await deleteSkill(toDelete.member.id, toDelete.skill.id);
            updateSkills(toDelete.member.id, (skills) => skills.filter((s) => s.id !== toDelete.skill.id));
            setToDelete(null);
            success(t.feedback.deleted);
          }}
        />
      )}
    </div>
  );
}
