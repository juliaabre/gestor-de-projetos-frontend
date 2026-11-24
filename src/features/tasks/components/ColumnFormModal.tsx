import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";
import { Modal } from "@/components/Modal";
import { FormError } from "@/components/FeedbackBanner";
import {
  fieldErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { getErrorMessage, getFieldErrors } from "@/lib/apiError";
import util from "@/lib/util.json";
import { statusKeyFromName } from "../board";
import { createColumn, updateColumn } from "../services/taskService";
import type { BoardColumn } from "../types";

const t = util.board.columnForm;

export function ColumnFormModal({
  projectId,
  column,
  columns,
  onClose,
  onSaved,
}: {
  projectId: number;
  column?: BoardColumn;
  columns: BoardColumn[];
  onClose: () => void;
  onSaved: (column: BoardColumn, mode: "created" | "updated") => void;
}) {
  const isEdit = Boolean(column);
  const [serverError, setServerError] = useState("");
  const others = columns.filter((c) => c.status !== column?.status);

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
  });
  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: column?.name ?? "" },
  });

  const onSubmit = async ({ name }: FormData) => {
    setServerError("");
    try {
      const saved =
        column && column.id != null
          ? await updateColumn(projectId, column.id, { name, status: column.status })
          : await createColumn(projectId, { name, status: statusKeyFromName(name) });
      onSaved(saved, isEdit ? "updated" : "created");
    } catch (error) {
      const message = getFieldErrors(error).nome;
      if (message) setError("name", { message });
      setServerError(getErrorMessage(error, t.saveError));
    }
  };

  return (
    <Modal
      title={isEdit ? t.editTitle : t.createTitle}
      description={isEdit ? undefined : t.description}
      onClose={isSubmitting ? () => {} : onClose}
      size="sm"
    >
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
