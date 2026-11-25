import { useId, useState, type FormEvent } from "react";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FeedbackBanner, FormError, useFeedback } from "@/components/FeedbackBanner";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { fieldErrorClass, inputClass, primaryButtonClass, smallButtonClass } from "@/components/ui";
import { getErrorMessage, getFieldErrors } from "@/lib/apiError";
import { fillTemplate } from "@/lib/format";
import util from "@/lib/util.json";
import { useRemoteList } from "@/features/tasks/hooks/useRemoteList";
import { createRule, deleteRule, listRules, updateRule } from "../services/knowledgeService";
import type { DomainRule } from "../types";

const t = util.admin.rules;
export const MIN_RULE = 5;
export const MAX_RULE = 1000;

function validateRule(text: string): string {
  const value = text.trim();
  if (!value) return t.required;
  if (value.length < MIN_RULE) return fillTemplate(t.tooShort, { min: MIN_RULE });
  if (value.length > MAX_RULE) return fillTemplate(t.tooLong, { max: MAX_RULE });
  return "";
}

function RuleEditor({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: string;
  submitLabel: string;
  onSubmit: (rule: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [fieldError, setFieldError] = useState("");
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const id = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const error = validateRule(value);
    setFieldError(error);
    if (error) return;
    setSaving(true);
    setServerError("");
    try {
      await onSubmit(value.trim());
      if (!onCancel) setValue("");
    } catch (err) {
      const apiField = getFieldErrors(err).regra;
      if (apiField) setFieldError(apiField);
      setServerError(getErrorMessage(err, t.saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <FormError message={serverError} />
      <label htmlFor={id} className="sr-only">{t.label}</label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (fieldError) setFieldError("");
        }}
        rows={3}
        placeholder={t.placeholder}
        aria-invalid={Boolean(fieldError)}
        className={`${inputClass} resize-y py-2.5 text-sm`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={fieldError ? fieldErrorClass : "text-xs text-slate-400"}>
          {fieldError || `${value.trim().length}/${MAX_RULE}`}
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={saving} className={smallButtonClass}>
              {util.common.cancel}
            </button>
          )}
          <button type="submit" disabled={saving} className={`${primaryButtonClass} h-9`}>
            {saving && <LoaderCircle className="size-4 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

export function RulesPanel() {
  const { state, reload, add, update } = useRemoteList<DomainRule>(listRules, t.loadError);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<DomainRule | null>(null);
  const { feedback, success, error, clear } = useFeedback();

  const replace = (rule: DomainRule) => update((items) => items.map((item) => (item.id === rule.id ? rule : item)));

  const toggle = async (rule: DomainRule) => {
    setTogglingId(rule.id);
    try {
      replace(await updateRule(rule.id, { rule: rule.rule, active: !rule.active }));
      success(rule.active ? t.deactivated : t.activated);
    } catch (err) {
      error(getErrorMessage(err, t.saveError));
    } finally {
      setTogglingId(null);
    }
  };

  if (state.status === "unavailable") return <EmptyState title={t.unavailableTitle} description={t.unavailable} />;

  return (
    <div className="flex flex-col gap-5">
      <FeedbackBanner feedback={feedback} onClose={clear} />
      <section aria-labelledby="new-rule-title" className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 id="new-rule-title" className="flex items-center gap-2 font-semibold text-slate-900">
          <Plus className="size-4" aria-hidden="true" /> {t.newTitle}
        </h2>
        <p className="mb-3 mt-1 text-sm text-slate-500">{t.description}</p>
        <RuleEditor
          initial=""
          submitLabel={t.create}
          onSubmit={async (rule) => {
            add(await createRule(rule), "start");
            success(t.created);
          }}
        />
      </section>

      <section aria-labelledby="rules-title">
        <h2 id="rules-title" className="mb-3 font-semibold text-slate-900">{t.listTitle}</h2>
        {state.status === "loading" && <LoadingState label={t.loading} />}
        {state.status === "error" && <ErrorState title={t.loadError} message={state.message} onRetry={reload} />}
        {state.status === "success" && state.items.length === 0 && (
          <EmptyState title={t.emptyTitle} description={t.emptyDescription} />
        )}
        {state.status === "success" && state.items.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label={t.listTitle}>
            {state.items.map((rule) => (
              <li key={rule.id} className={`rounded-2xl border bg-white p-4 ${rule.active ? "border-slate-200" : "border-dashed border-slate-300 bg-slate-50"}`}>
                {editingId === rule.id ? (
                  <RuleEditor
                    initial={rule.rule}
                    submitLabel={t.save}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (text) => {
                      replace(await updateRule(rule.id, { rule: text, active: rule.active }));
                      setEditingId(null);
                      success(t.updated);
                    }}
                  />
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <p className={`min-w-0 flex-1 whitespace-pre-wrap break-words text-sm ${rule.active ? "text-slate-800" : "text-slate-500"}`}>
                      {rule.rule}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={rule.active}
                          disabled={togglingId === rule.id}
                          onChange={() => toggle(rule)}
                          className="size-4 accent-blue-600"
                        />
                        {rule.active ? t.active : t.inactive}
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditingId(rule.id)}
                        aria-label={t.edit}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setToDelete(rule)}
                        aria-label={t.delete}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-700"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {toDelete && (
        <ConfirmDialog
          title={t.deleteDialog.title}
          description={t.deleteDialog.description}
          confirmLabel={t.deleteDialog.confirm}
          confirmingLabel={t.deleteDialog.confirming}
          getError={(err) => getErrorMessage(err, t.deleteDialog.error)}
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            await deleteRule(toDelete.id);
            update((items) => items.filter((item) => item.id !== toDelete.id));
            setToDelete(null);
            success(t.deleted);
          }}
        />
      )}
    </div>
  );
}
