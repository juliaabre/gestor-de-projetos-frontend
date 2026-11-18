import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Modal } from "./Modal";
import util from "@/lib/util.json";

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmingLabel,
  onConfirm,
  onClose,
  getError,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  confirmingLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  getError: (error: unknown) => string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setPending(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(getError(err));
      setPending(false);
    }
  };

  return (
    <Modal
      title={title}
      description={description}
      onClose={pending ? () => {} : onClose}
      size="sm"
    >
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {util.common.cancel}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-70"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          {pending ? confirmingLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
