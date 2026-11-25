import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Search } from "lucide-react";
import { Modal } from "@/components/Modal";
import { FormError } from "@/components/FeedbackBanner";
import { TagInput } from "@/components/TagInput";
import {
  fieldErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { getErrorMessage, getFieldErrors } from "@/lib/apiError";
import { fillTemplate } from "@/lib/format";
import util from "@/lib/util.json";
import type { TeamMember } from "@/features/projects/types";
import { DescriptionAssistant } from "@/features/ai/components/DescriptionAssistant";
import { dependentsOf } from "../board";
import { taskSchema, type TaskFormData } from "../schemas/taskSchema";
import { createTask, updateTask } from "../services/taskService";
import { unsavedTaskFields } from "../board";
import {
  TASK_COMPLEXITIES,
  TASK_PRIORITIES,
  type BoardColumn,
  type Task,
  type TaskComplexity,
  type TaskInput,
  type TaskStatus,
} from "../types";

const t = util.tasks.form;

const API_FIELD_TO_FORM: Record<string, keyof TaskFormData> = {
  titulo: "title",
  conteudo: "content",
  requisitos: "requirements",
  tecnologias: "technologies",
  status: "status",
  prioridade: "priority",
  complexidade: "complexity",
  prazo: "dueDate",
  responsavelId: "assigneeId",
  dependenciasIds: "dependencyIds",
};

export function TaskFormModal({
  task,
  projectId,
  defaultStatus,
  columns,
  team,
  tasks,
  onClose,
  onSaved,
}: {
  task?: Task;
  projectId: number;
  defaultStatus?: TaskStatus;
  columns: BoardColumn[];
  team: TeamMember[];
  tasks: Task[];
  onClose: () => void;
  /** `unsaved` lista os campos que o servidor não gravou. */
  onSaved: (task: Task, mode: "created" | "updated", unsaved: string[]) => void;
}) {
  const isEdit = Boolean(task);
  const [serverError, setServerError] = useState("");
  const [depSearch, setDepSearch] = useState("");

  const {
    register,
    control,
    handleSubmit,
    setError,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title ?? "",
      content: task?.content ?? "",
      requirements: task?.requirements ?? "",
      technologies: task?.technologies ?? [],
      status: task?.status ?? defaultStatus ?? columns[0]?.status ?? "TODO",
      priority: task?.priority ?? "MEDIUM",
      complexity: task?.complexity != null ? (String(task.complexity) as TaskFormData["complexity"]) : "",
      dueDate: task?.dueDate ?? "",
      assigneeId: task?.assigneeId != null ? String(task.assigneeId) : "",
      dependencyIds: task?.dependencyIds ?? [],
    },
  });

  const dependencyOptions = useMemo(() => {
    const blocked = task ? dependentsOf(task.id, tasks) : new Set<number>();
    const query = depSearch.trim().toLowerCase();
    return tasks.filter(
      (candidate) =>
        candidate.id !== task?.id &&
        !blocked.has(candidate.id) &&
        (!query || candidate.title.toLowerCase().includes(query)),
    );
  }, [task, tasks, depSearch]);

  const columnName = (status: TaskStatus) =>
    columns.find((c) => c.status === status)?.name ?? status;

  const onSubmit = async (data: TaskFormData) => {
    setServerError("");
    const input: TaskInput = {
      title: data.title,
      content: data.content || undefined,
      requirements: data.requirements || undefined,
      technologies: data.technologies,
      status: data.status,
      priority: data.priority,
      complexity: data.complexity ? (Number(data.complexity) as TaskComplexity) : null,
      dueDate: data.dueDate || null,
      assigneeId: data.assigneeId ? Number(data.assigneeId) : null,
      dependencyIds: data.dependencyIds,
      projectId,
    };
    try {
      const saved = task ? await updateTask(task.id, input) : await createTask(input);
      onSaved(saved, isEdit ? "updated" : "created", unsavedTaskFields(input, saved));
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
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <FormError message={serverError} />

        <label className={labelClass}>
          {t.title}
          <input
            {...register("title")}
            placeholder={t.titlePlaceholder}
            aria-invalid={Boolean(errors.title)}
            className={`${inputClass} h-11`}
          />
          {errors.title && <span className={fieldErrorClass}>{errors.title.message}</span>}
        </label>

        <label className={labelClass}>
          {t.content}
          <textarea
            {...register("content")}
            rows={3}
            placeholder={t.contentPlaceholder}
            aria-invalid={Boolean(errors.content)}
            className={`${inputClass} resize-y py-3`}
          />
          {errors.content && <span className={fieldErrorClass}>{errors.content.message}</span>}
        </label>
        <DescriptionAssistant
          taskId={task?.id}
          getTitle={() => getValues("title")}
          getCurrent={() => getValues("content")}
          getRequirements={() => getValues("requirements")}
          onAccept={(description) =>
            setValue("content", description, { shouldDirty: true, shouldValidate: true })
          }
        />

        <label className={labelClass}>
          {t.requirements}
          <textarea
            {...register("requirements")}
            rows={3}
            placeholder={t.requirementsPlaceholder}
            aria-invalid={Boolean(errors.requirements)}
            className={`${inputClass} resize-y py-3`}
          />
          {errors.requirements && (
            <span className={fieldErrorClass}>{errors.requirements.message}</span>
          )}
        </label>

        <Controller
          control={control}
          name="technologies"
          render={({ field, fieldState }) => (
            <TagInput
              label={t.technologies}
              value={field.value}
              onChange={field.onChange}
              placeholder={t.technologiesPlaceholder}
              error={fieldState.error?.message}
              maxTags={30}
              maxLength={100}
            />
          )}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            {t.status}
            <select {...register("status")} aria-invalid={Boolean(errors.status)} className={`${inputClass} h-11`}>
              {columns.map((column) => (
                <option key={column.status} value={column.status}>
                  {column.name}
                </option>
              ))}
            </select>
            {errors.status && <span className={fieldErrorClass}>{errors.status.message}</span>}
          </label>

          <label className={labelClass}>
            {t.assignee}
            <select {...register("assigneeId")} aria-invalid={Boolean(errors.assigneeId)} className={`${inputClass} h-11`}>
              <option value="">{t.noAssignee}</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.username}
                </option>
              ))}
            </select>
            {errors.assigneeId && <span className={fieldErrorClass}>{errors.assigneeId.message}</span>}
          </label>

          <label className={labelClass}>
            {t.priority}
            <select {...register("priority")} aria-invalid={Boolean(errors.priority)} className={`${inputClass} h-11`}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {errors.priority && <span className={fieldErrorClass}>{errors.priority.message}</span>}
          </label>

          <label className={labelClass}>
            {t.complexity}
            <select {...register("complexity")} aria-invalid={Boolean(errors.complexity)} className={`${inputClass} h-11`}>
              <option value="">{t.noComplexity}</option>
              {TASK_COMPLEXITIES.map((c) => (
                <option key={c.value} value={String(c.value)}>
                  {c.value} · {c.label}
                </option>
              ))}
            </select>
            {errors.complexity && <span className={fieldErrorClass}>{errors.complexity.message}</span>}
          </label>

          <label className={labelClass}>
            {t.dueDate}
            <input
              type="date"
              {...register("dueDate")}
              aria-invalid={Boolean(errors.dueDate)}
              className={`${inputClass} h-11`}
            />
            {errors.dueDate && <span className={fieldErrorClass}>{errors.dueDate.message}</span>}
          </label>
        </div>

        <Controller
          control={control}
          name="dependencyIds"
          render={({ field }) => (
            <fieldset className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <legend className="text-sm font-medium text-slate-700">{t.dependencies}</legend>
                <span className="text-xs text-slate-500">
                  {fillTemplate(t.dependenciesSelected, { count: field.value.length })}
                </span>
              </div>
              <p className="text-xs text-slate-500">{t.dependenciesHint}</p>
              {tasks.length > 1 && (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="search"
                    value={depSearch}
                    onChange={(e) => setDepSearch(e.target.value)}
                    placeholder={t.dependenciesSearch}
                    aria-label={t.dependenciesSearch}
                    className={`${inputClass} h-10 pl-9 text-sm`}
                  />
                </div>
              )}
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200">
                {dependencyOptions.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">{t.dependenciesEmpty}</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {dependencyOptions.map((candidate) => {
                      const checked = field.value.includes(candidate.id);
                      return (
                        <li key={candidate.id}>
                          <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                field.onChange(
                                  checked
                                    ? field.value.filter((id) => id !== candidate.id)
                                    : [...field.value, candidate.id],
                                )
                              }
                              className="size-4 accent-blue-600"
                            />
                            <span className="min-w-0 flex-1 truncate text-slate-800">{candidate.title}</span>
                            <span className="shrink-0 text-xs text-slate-500">
                              {columnName(candidate.status)}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </fieldset>
          )}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isSubmitting} className={secondaryButtonClass}>
            {util.common.cancel}
          </button>
          <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
            {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
            {isSubmitting ? t.saving : isEdit ? t.save : t.create}
          </button>
        </div>
      </form>
    </Modal>
  );
}
