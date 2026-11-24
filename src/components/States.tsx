import type { ReactNode } from "react";
import { Inbox, LoaderCircle } from "lucide-react";
import util from "@/lib/util.json";

export function LoadingState({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <p
      role="status"
      className={`flex items-center justify-center gap-2 text-sm text-slate-500 ${
        compact ? "py-6" : "py-16"
      }`}
    >
      <LoaderCircle className="size-4 animate-spin" /> {label}
    </p>
  );
}

export function ErrorState({
  title,
  message,
  onRetry,
  compact = false,
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={`rounded-2xl border border-red-200 bg-red-50 text-center ${compact ? "p-4" : "p-8"}`}
    >
      <p className="font-medium text-red-800">{title}</p>
      {message && message !== title && (
        <p className="mt-1 text-sm text-red-700">{message}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
        >
          {util.common.retry}
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  compact = false,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-slate-300 bg-white text-center ${
        compact ? "p-5" : "p-12"
      }`}
    >
      {!compact && (icon ?? <Inbox className="mx-auto text-slate-300" />)}
      <p className={`font-medium text-slate-700 ${compact ? "text-sm" : "mt-3"}`}>{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {children}
    </div>
  );
}
