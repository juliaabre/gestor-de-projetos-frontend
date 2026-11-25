import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { FeedbackBanner, FormError, useFeedback } from "@/components/FeedbackBanner";
import { ErrorState, LoadingState } from "@/components/States";
import { fieldErrorClass, inputClass, labelClass, primaryButtonClass } from "@/components/ui";
import { getErrorMessage, getFieldErrors } from "@/lib/apiError";
import util from "@/lib/util.json";
import { getDomain, saveDomain } from "../services/knowledgeService";
import type { DomainSettings } from "../types";

const t = util.admin.domain;
/** Limite do backend para cada campo. */
export const MAX_DOMAIN_LENGTH = 4000;

/** Regras de domínio e vocabulário que orientam a IA (somente administrador). */
export function DomainPanel() {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ready" }
  >({ status: "loading" });
  const [form, setForm] = useState<DomainSettings>({ rules: "", vocabulary: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof DomainSettings, string>>>({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const { feedback, success, clear } = useFeedback();

  const load = () => {
    setState({ status: "loading" });
    getDomain()
      .then((data) => {
        setForm(data);
        setState({ status: "ready" });
      })
      .catch((error) => setState({ status: "error", message: getErrorMessage(error, t.loadError) }));
  };
  useEffect(load, []);

  const validate = (data: DomainSettings) => {
    const next: typeof errors = {};
    if (!data.rules.trim()) next.rules = t.rulesRequired;
    if (data.rules.length > MAX_DOMAIN_LENGTH) next.rules = t.tooLong;
    if (data.vocabulary.length > MAX_DOMAIN_LENGTH) next.vocabulary = t.tooLong;
    return next;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setServerError("");
    try {
      setForm(await saveDomain({ rules: form.rules.trim(), vocabulary: form.vocabulary.trim() }));
      success(t.saved);
    } catch (error) {
      const fields = getFieldErrors(error);
      setErrors({ rules: fields.regras, vocabulary: fields.vocabulario });
      setServerError(getErrorMessage(error, t.saveError));
    } finally {
      setSaving(false);
    }
  };

  if (state.status === "loading") return <LoadingState label={t.loading} />;
  if (state.status === "error") return <ErrorState title={t.loadError} message={state.message} onRetry={load} />;

  const field = (key: keyof DomainSettings, label: string, hint: string, placeholder: string, rows: number) => (
    <label className={labelClass}>
      {label}
      <textarea
        value={form[key]}
        onChange={(e) => {
          setForm((prev) => ({ ...prev, [key]: e.target.value }));
          if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
        }}
        rows={rows}
        maxLength={MAX_DOMAIN_LENGTH}
        placeholder={placeholder}
        aria-invalid={Boolean(errors[key])}
        className={`${inputClass} resize-y py-3 text-sm`}
      />
      <span className={errors[key] ? fieldErrorClass : "flex justify-between gap-2 text-xs font-normal text-slate-500"}>
        {errors[key] ?? (
          <>
            <span>{hint}</span>
            <span>
              {form[key].length}/{MAX_DOMAIN_LENGTH}
            </span>
          </>
        )}
      </span>
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5">
      <FeedbackBanner feedback={feedback} onClose={clear} />
      <FormError message={serverError} />
      <p className="text-sm text-slate-500">{t.description}</p>
      {field("rules", t.rules, t.rulesHint, t.rulesPlaceholder, 8)}
      {field("vocabulary", t.vocabulary, t.vocabularyHint, t.vocabularyPlaceholder, 6)}
      <button type="submit" disabled={saving} className={`${primaryButtonClass} w-full sm:w-fit sm:self-end`}>
        {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
        {saving ? t.saving : t.save}
      </button>
    </form>
  );
}
