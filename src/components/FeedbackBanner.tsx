import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import util from "@/lib/util.json";

export type Feedback = { kind: "success" | "error"; message: string };

export function useFeedback() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (feedback?.kind !== "success") return;
    const timeoutId = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timeoutId);
  }, [feedback]);

  const success = useCallback(
    (message: string) => setFeedback({ kind: "success", message }),
    [],
  );
  const error = useCallback(
    (message: string) => setFeedback({ kind: "error", message }),
    [],
  );
  const clear = useCallback(() => setFeedback(null), []);

  return { feedback, success, error, clear };
}

export function FeedbackBanner({
  feedback,
  onClose,
  className = "",
}: {
  feedback: Feedback | null;
  onClose: () => void;
  className?: string;
}) {
  if (!feedback) return null;
  return (
    <div
      role={feedback.kind === "error" ? "alert" : "status"}
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        feedback.kind === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      } ${className}`}
    >
      <span>{feedback.message}</span>
      <button type="button" onClick={onClose} aria-label={util.common.close}>
        <X className="size-4" />
      </button>
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {message}
    </div>
  );
}
