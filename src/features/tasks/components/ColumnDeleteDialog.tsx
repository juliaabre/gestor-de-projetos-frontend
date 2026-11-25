import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Modal } from "@/components/Modal";
import { FormError } from "@/components/FeedbackBanner";
import { inputClass, labelClass, secondaryButtonClass } from "@/components/ui";
import { getErrorMessage } from "@/lib/apiError";
import { fillTemplate } from "@/lib/format";
import util from "@/lib/util.json";
import { deleteColumn } from "../services/taskService";
import type { BoardColumn, TaskStatus } from "../types";

const t = util.board.columnDelete;

/** Confirma a exclusão de uma coluna e, se ela tiver tarefas, pergunta para onde movê-las. */
export function ColumnDeleteDialog({
  projectId,
  column,
  columns,
  taskCount,
  onClose,
  onDeleted,
}: {
  projectId: number;
  column: BoardColumn;
  columns: BoardColumn[];
  taskCount: number;
  onClose: () => void;
  onDeleted: (moveTo?: TaskStatus) => void;
}) {
  const targets = columns.filter((c) => c.status !== column.status && c.id != null);
  const [moveTo, setMoveTo] = useState<TaskStatus>(targets[0]?.status ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    if (column.id == null) return;
    setPending(true);
    setError("");
    try {
      const destination = taskCount > 0 ? moveTo : undefined;
      await deleteColumn(projectId, column.id, destination);
      onDeleted(destination);
    } catch (err) {
      setError(getErrorMessage(err, t.error));
      setPending(false);
    }
  };

  return (
    <Modal
      title={fillTemplate(t.title, { name: column.name })}
      description={taskCount > 0 ? fillTemplate(t.withTasks, { count: taskCount }) : t.empty}
      onClose={pending ? () => {} : onClose}
      size="sm"
    >
      <div className="flex flex-col gap-5">
        <FormError message={error} />
        {taskCount > 0 && (
          <label className={labelClass}>
            {t.moveTo}
            <select
              value={moveTo}
              onChange={(event) => setMoveTo(event.target.value)}
              disabled={pending}
              className={`${inputClass} h-11`}
            >
              {targets.map((target) => (
                <option key={target.status} value={target.status}>
                  {target.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={pending} className={secondaryButtonClass}>
            {util.common.cancel}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending || (taskCount > 0 && !moveTo)}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-70"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            {pending ? t.confirming : t.confirm}
          </button>
        </div>
      </div>
    </Modal>
  );
}
