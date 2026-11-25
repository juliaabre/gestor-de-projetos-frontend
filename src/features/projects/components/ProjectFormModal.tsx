import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Search } from "lucide-react";
import { Modal } from "@/components/Modal";
import { getErrorMessage, getFieldErrors, isForbidden } from "@/lib/apiError";
import util from "@/lib/util.json";
import {
  listUsers,
  type UserSummary,
} from "@/features/users/services/userService";
import { createProject, updateProject } from "../services/projectService";
import { projectSchema, type ProjectFormData } from "../schemas/projectSchema";
import type { Project } from "../types";
import { Avatar } from "./Avatar";

const t = util.projects.form;

const API_FIELD_TO_FORM: Record<string, keyof ProjectFormData> = {
  nome: "name",
  descricao: "description",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 font-normal text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

export function ProjectFormModal({
  project,
  currentUserId,
  onClose,
  onSaved,
}: {
  project?: Project;
  currentUserId?: number;
  onClose: () => void;
  onSaved: (project: Project, mode: "created" | "updated") => void;
}) {
  const isEdit = Boolean(project);
  // Criador e gerente atual sempre ficam na equipe (regra do backend).
  const lockedIds = new Set(
    (project ? [project.creatorId, project.managerId] : [currentUserId]).filter(
      (id): id is number => id != null,
    ),
  );

  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [usersError, setUsersError] = useState(false);
  /** O diretório de usuários é liberado só a gerentes de projeto e administradores. */
  const [usersForbidden, setUsersForbidden] = useState(false);
  const [managerId, setManagerId] = useState<number | null>(project?.managerId ?? null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () =>
      new Set(
        project?.teamIds ?? (currentUserId != null ? [currentUserId] : []),
      ),
  );
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name ?? "",
      description: project?.description ?? "",
    },
  });

  const loadUsers = () => {
    setUsersError(false);
    setUsers(null);
    setUsersForbidden(false);
    listUsers()
      .then(setUsers)
      .catch((error) => (isForbidden(error) ? setUsersForbidden(true) : setUsersError(true)));
  };
  useEffect(loadUsers, []);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const query = search.trim().toLowerCase();
    return [...users]
      .filter(
        (user) =>
          !query ||
          user.username.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query),
      )
      .sort((a, b) => a.username.localeCompare(b.username, "pt-BR"));
  }, [users, search]);

  const toggleMember = (id: number) => {
    if (lockedIds.has(id)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSubmit = async (data: ProjectFormData) => {
    setServerError("");
    const input = {
      name: data.name,
      description: data.description || undefined,
      teamIds: users ? [...selectedIds] : isEdit ? undefined : [],
      managerId: project && managerId != null && managerId !== project.managerId ? managerId : undefined,
    };
    try {
      const saved = project
        ? await updateProject(project.id, input)
        : await createProject(input);
      onSaved(saved, isEdit ? "updated" : "created");
    } catch (error) {
      for (const [apiField, message] of Object.entries(getFieldErrors(error))) {
        const field = API_FIELD_TO_FORM[apiField];
        if (field) setError(field, { message });
      }
      setServerError(getErrorMessage(error, t.saveError));
    }
  };

  return (
    <Modal
      title={isEdit ? t.editTitle : t.createTitle}
      onClose={isSubmitting ? () => {} : onClose}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-5"
      >
        {serverError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {serverError}
          </div>
        )}

        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          {t.name}
          <input
            {...register("name")}
            placeholder={t.namePlaceholder}
            aria-invalid={Boolean(errors.name)}
            className={`${inputClass} h-11`}
          />
          {errors.name && (
            <span className="text-xs font-normal text-red-600">
              {errors.name.message}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          {t.description}
          <textarea
            {...register("description")}
            rows={3}
            placeholder={t.descriptionPlaceholder}
            className={`${inputClass} resize-y py-3`}
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <legend className="text-sm font-medium text-slate-700">
              {t.team}
            </legend>
            <span className="text-xs text-slate-500">
              {t.teamSelected.replace("{count}", String(selectedIds.size))}
            </span>
          </div>
          <p className="text-xs text-slate-500">{t.teamHint}</p>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.teamSearch}
              aria-label={t.teamSearch}
              className={`${inputClass} h-10 pl-9 text-sm`}
            />
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
            {usersForbidden ? (
              <p role="status" className="p-4 text-sm leading-6 text-slate-600">
                {isEdit ? t.teamForbiddenEdit : t.teamForbidden}
              </p>
            ) : usersError ? (
              <p role="alert" className="p-4 text-sm text-red-700">
                {t.teamError}{" "}
                <button
                  type="button"
                  onClick={loadUsers}
                  className="font-semibold underline"
                >
                  {util.common.retry}
                </button>
              </p>
            ) : !users ? (
              <p className="flex items-center gap-2 p-4 text-sm text-slate-500">
                <LoaderCircle className="size-4 animate-spin" /> {t.teamLoading}
              </p>
            ) : filteredUsers.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">{t.teamEmpty}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const locked = lockedIds.has(user.id);
                  return (
                    <li key={user.id}>
                      <label
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                          locked
                            ? "cursor-not-allowed"
                            : "cursor-pointer hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(user.id) || locked}
                          disabled={locked}
                          onChange={() => toggleMember(user.id)}
                          className="size-4 accent-blue-600"
                        />
                        <Avatar name={user.username} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-800">
                            {user.username}
                            {user.id === currentUserId && (
                              <span className="font-normal text-slate-500">
                                {" "}
                                ({t.you})
                              </span>
                            )}
                            {locked && (
                              <span className="font-normal text-slate-500">
                                {" "}
                                · {user.id === project?.managerId ? t.manager : t.creator}
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {user.email}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </fieldset>

        {project && (
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            {t.managerLabel}
            <select
              value={managerId ?? ""}
              onChange={(event) => setManagerId(Number(event.target.value))}
              className={`${inputClass} h-11`}
            >
              {(users ? users.filter((user) => selectedIds.has(user.id) || lockedIds.has(user.id)) : project.team).map(
                (member) => (
                  <option key={member.id} value={member.id}>
                    {member.username}
                  </option>
                ),
              )}
            </select>
            <span className="text-xs font-normal text-slate-500">{t.managerHint}</span>
          </label>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {util.common.cancel}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
          >
            {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
            {isSubmitting ? t.saving : isEdit ? t.save : t.create}
          </button>
        </div>
      </form>
    </Modal>
  );
}
