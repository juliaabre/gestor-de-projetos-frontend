import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, LoaderCircle, Trash2 } from "lucide-react";
import { z } from "zod";
import { Modal } from "@/components/Modal";
import { FormError } from "@/components/FeedbackBanner";
import {
  dangerSmallButtonClass,
  fieldErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { getErrorMessage, getFieldErrors } from "@/lib/apiError";
import { fillTemplate } from "@/lib/format";
import util from "@/lib/util.json";
import { statusKeyFromName } from "../board";
import { createColumn, listColumns, reorderColumns, updateColumn } from "../services/taskService";
import type { BoardColumn } from "../types";

const t = util.board.columnForm;

/**
 * Cria ou edita uma coluna do quadro: nome, posição e, na edição, acesso à
 * exclusão. `available` é falso quando o servidor não oferece colunas
 * personalizadas; nesse caso o formulário explica o motivo em vez de falhar.
 */
export function ColumnFormModal({
  projectId,
  column,
  columns,
  available,
  onClose,
  onSaved,
  onDelete,
}: {
  projectId: number;
  column?: BoardColumn;
  columns: BoardColumn[];
  available: boolean;
  onClose: () => void;
  /** `reordered` traz a lista completa quando a posição mudou. */
  onSaved: (column: BoardColumn, mode: "created" | "updated", reordered?: BoardColumn[]) => void;
  onDelete?: () => void;
}) {
  const isEdit = Boolean(column);
  const [serverError, setServerError] = useState("");
  const others = columns.filter((c) => c.status !== column?.status);
  // Só colunas gravadas no servidor têm posição própria.
  const persisted = columns.filter((c) => c.id != null);
  const currentIndex = column ? persisted.findIndex((c) => c.id === column.id) : persisted.length;
  const positions = isEdit ? persisted.length : persisted.length + 1;

  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(1, t.nameRequired)
      .max(50, t.nameTooLong)
      .refine((name) => isEdit || statusKeyFromName(name).length > 0, t.nameInvalid)
      .refine(
        (name) =>
          !others.some(
            (c) =>
              c.name.toLowerCase() === name.toLowerCase() ||
              (!isEdit && c.status === statusKeyFromName(name)),
          ),
        t.nameDuplicate,
      ),
    position: z.string(),
  });
  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: column?.name ?? "", position: String(Math.max(currentIndex, 0)) },
  });

  const onSubmit = async ({ name, position }: FormData) => {
    setServerError("");
    try {
      let saved: BoardColumn;
      if (column && column.id != null) {
        saved =
          name === column.name
            ? column
            : await updateColumn(projectId, column.id, { name, status: column.status });
      } else {
        saved = await createColumn(projectId, { name, status: statusKeyFromName(name) });
      }

      const target = Number(position);
      let reordered: BoardColumn[] | undefined;
      if (persisted.length === 0) {
        // Primeira coluna personalizada: o quadro acabou de ser criado com as
        // colunas padrão, que passam a ter id e podem ser editadas.
        reordered = await listColumns(projectId);
      } else if (saved.id != null && target !== currentIndex) {
        const ids = persisted.map((c) => c.id!).filter((id) => id !== saved.id);
        ids.splice(target, 0, saved.id);
        reordered = await reorderColumns(projectId, ids);
      }
      onSaved(saved, isEdit ? "updated" : "created", reordered);
    } catch (error) {
      const message = getFieldErrors(error).nome;
      if (message) setError("name", { message });
      setServerError(getErrorMessage(error, t.saveError));
    }
  };

  const lastColumn = persisted.length <= 1;

  return (
    <Modal
      title={isEdit ? t.editTitle : t.createTitle}
      description={isEdit ? undefined : t.description}
      onClose={isSubmitting ? () => {} : onClose}
      size="sm"
    >
      {!available ? (
        <div className="flex flex-col gap-5">
          <p
            role="status"
            className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600"
          >
            <Info className="mt-1 size-4 shrink-0" aria-hidden="true" />
            {t.unavailable}
          </p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={secondaryButtonClass}>
              {util.common.close}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <FormError message={serverError} />
          <label className={labelClass}>
            {t.name}
            <input
              {...register("name")}
              placeholder={t.namePlaceholder}
              aria-invalid={Boolean(errors.name)}
              className={`${inputClass} h-11`}
            />
            {errors.name && <span className={fieldErrorClass}>{errors.name.message}</span>}
          </label>

          {positions > 1 && (
            <label className={labelClass}>
              {t.position}
              <select {...register("position")} className={`${inputClass} h-11`}>
                {Array.from({ length: positions }, (_, index) => {
                  const neighbour = persisted.filter((c) => c.id !== column?.id)[index];
                  return (
                    <option key={index} value={index}>
                      {neighbour
                        ? fillTemplate(t.positionBefore, { n: index + 1, name: neighbour.name })
                        : fillTemplate(t.positionLast, { n: index + 1 })}
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {isEdit && onDelete ? (
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isSubmitting || lastColumn}
                  className={`${dangerSmallButtonClass} justify-center`}
                >
                  <Trash2 className="size-4" aria-hidden="true" /> {t.delete}
                </button>
                {lastColumn && <span className="text-xs text-slate-500">{t.deleteLastHint}</span>}
              </div>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" onClick={onClose} disabled={isSubmitting} className={secondaryButtonClass}>
                {util.common.cancel}
              </button>
              <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
                {isSubmitting && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
                {isSubmitting ? t.saving : isEdit ? t.save : t.create}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
