import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { z } from "zod";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FeedbackBanner, FormError, useFeedback } from "@/components/FeedbackBanner";
import { Modal } from "@/components/Modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
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
import { useRemoteList } from "@/features/tasks/hooks/useRemoteList";
import { createTerm, deleteTerm, listTerms, updateTerm } from "../services/knowledgeService";
import type { VocabularyTerm } from "../types";

const t = util.admin.vocabulary;

const termSchema = z.object({
  term: z.string().trim().min(1, t.termRequired).max(100, t.termTooLong),
  definition: z.string().trim().min(1, t.definitionRequired).max(1000, t.definitionTooLong),
  synonyms: z.array(z.string()).max(20, t.synonymsTooMany),
});
type TermForm = z.infer<typeof termSchema>;

const API_FIELD: Record<string, keyof TermForm> = { termo: "term", definicao: "definition", sinonimos: "synonyms" };

function TermFormModal({
  term,
  existing,
  onClose,
  onSaved,
}: {
  term?: VocabularyTerm;
  existing: VocabularyTerm[];
  onClose: () => void;
  onSaved: (term: VocabularyTerm, mode: "created" | "updated") => void;
}) {
  const [serverError, setServerError] = useState("");
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TermForm>({
    resolver: zodResolver(termSchema),
    defaultValues: { term: term?.term ?? "", definition: term?.definition ?? "", synonyms: term?.synonyms ?? [] },
  });

  const onSubmit = async (data: TermForm) => {
    const duplicate = existing.some(
      (item) => item.id !== term?.id && item.term.toLowerCase() === data.term.toLowerCase(),
    );
    if (duplicate) return setError("term", { message: t.termDuplicate });
    setServerError("");
    try {
      const saved = term ? await updateTerm(term.id, data) : await createTerm(data);
      onSaved(saved, term ? "updated" : "created");
    } catch (error) {
      for (const [apiField, message] of Object.entries(getFieldErrors(error))) {
        if (API_FIELD[apiField]) setError(API_FIELD[apiField], { message });
      }
      setServerError(getErrorMessage(error, t.saveError));
    }
  };

  return (
    <Modal title={term ? t.editTitle : t.createTitle} onClose={isSubmitting ? () => {} : onClose}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <FormError message={serverError} />
        <label className={labelClass}>
          {t.term}
          <input {...register("term")} placeholder={t.termPlaceholder} aria-invalid={Boolean(errors.term)} className={`${inputClass} h-11`} />
          {errors.term && <span className={fieldErrorClass}>{errors.term.message}</span>}
        </label>
        <label className={labelClass}>
          {t.definition}
          <textarea
            {...register("definition")}
            rows={3}
            placeholder={t.definitionPlaceholder}
            aria-invalid={Boolean(errors.definition)}
            className={`${inputClass} resize-y py-3`}
          />
          {errors.definition && <span className={fieldErrorClass}>{errors.definition.message}</span>}
        </label>
        <Controller
          control={control}
          name="synonyms"
          render={({ field, fieldState }) => (
            <TagInput
              label={t.synonyms}
              value={field.value}
              onChange={field.onChange}
              placeholder={t.synonymsPlaceholder}
              error={fieldState.error?.message}
              maxTags={20}
              maxLength={60}
            />
          )}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isSubmitting} className={secondaryButtonClass}>
            {util.common.cancel}
          </button>
          <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
            {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
            {isSubmitting ? t.saving : term ? t.save : t.create}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function VocabularyPanel() {
  const { state, reload, add, update } = useRemoteList<VocabularyTerm>(listTerms, t.loadError);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<{ term?: VocabularyTerm } | null>(null);
  const [toDelete, setToDelete] = useState<VocabularyTerm | null>(null);
  const { feedback, success, clear } = useFeedback();

  if (state.status === "unavailable") return <EmptyState title={t.unavailableTitle} description={t.unavailable} />;

  const items = state.status === "success" ? state.items : [];
  const query = search.trim().toLowerCase();
  const visible = items
    .filter(
      (item) =>
        !query ||
        item.term.toLowerCase().includes(query) ||
        item.definition.toLowerCase().includes(query) ||
        item.synonyms.some((s) => s.toLowerCase().includes(query)),
    )
    .sort((a, b) => a.term.localeCompare(b.term, "pt-BR"));

  return (
    <div className="flex flex-col gap-5">
      <FeedbackBanner feedback={feedback} onClose={clear} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">{t.description}</p>
        <button type="button" onClick={() => setForm({})} disabled={state.status !== "success"} className={`${primaryButtonClass} shrink-0`}>
          <Plus className="size-4" /> {t.newTerm}
        </button>
      </div>

      {state.status === "loading" && <LoadingState label={t.loading} />}
      {state.status === "error" && <ErrorState title={t.loadError} message={state.message} onRetry={reload} />}
      {state.status === "success" && items.length === 0 && <EmptyState title={t.emptyTitle} description={t.emptyDescription} />}

      {items.length > 0 && (
        <>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              aria-label={t.search}
              className={`${inputClass} h-10 pl-9 text-sm`}
            />
          </div>
          {visible.length === 0 ? (
            <EmptyState title={t.noResults} compact />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2" aria-label={t.listTitle}>
              {visible.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{item.term}</h3>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => setForm({ term: item })}
                        aria-label={fillTemplate(t.edit, { term: item.term })}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setToDelete(item)}
                        aria-label={fillTemplate(t.delete, { term: item.term })}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-700"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-600">{item.definition}</p>
                  {item.synonyms.length > 0 && (
                    <ul className="flex flex-wrap gap-1" aria-label={t.synonyms}>
                      {item.synonyms.map((s) => (
                        <li key={s} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{s}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {form && (
        <TermFormModal
          term={form.term}
          existing={items}
          onClose={() => setForm(null)}
          onSaved={(saved, mode) => {
            setForm(null);
            if (mode === "created") add(saved);
            else update((list) => list.map((item) => (item.id === saved.id ? saved : item)));
            success(fillTemplate(mode === "created" ? t.created : t.updated, { term: saved.term }));
          }}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title={t.deleteDialog.title}
          description={fillTemplate(t.deleteDialog.description, { term: toDelete.term })}
          confirmLabel={t.deleteDialog.confirm}
          confirmingLabel={t.deleteDialog.confirming}
          getError={(err) => getErrorMessage(err, t.deleteDialog.error)}
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            await deleteTerm(toDelete.id);
            update((list) => list.filter((item) => item.id !== toDelete.id));
            setToDelete(null);
            success(fillTemplate(t.deleted, { term: toDelete.term }));
          }}
        />
      )}
    </div>
  );
}
