import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import util from "@/lib/util.json";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Mantém o Tab circulando dentro do diálogo enquanto ele estiver aberto. */
function trapFocus(e: KeyboardEvent, panel: HTMLElement) {
  const dialogs = document.querySelectorAll('[role="dialog"]');
  if (dialogs[dialogs.length - 1] !== panel) return;
  const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === panel)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
    e.preventDefault();
    first.focus();
  }
}

const SIZES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-3xl",
} as const;

export function Modal({
  title,
  description,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(
      "input, textarea, select, button:not([data-modal-close])",
    );
    (first ?? panelRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Só o diálogo mais recente fecha (ex.: confirmação aberta sobre outro modal).
        const dialogs = document.querySelectorAll('[role="dialog"]');
        if (dialogs[dialogs.length - 1] === panelRef.current) onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && panelRef.current) trapFocus(e, panelRef.current);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl outline-none sm:rounded-2xl ${SIZES[size]}`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm leading-6 text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            data-modal-close
            onClick={onClose}
            aria-label={util.common.close}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
