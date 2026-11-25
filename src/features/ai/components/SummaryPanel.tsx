import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/States";
import { inputClass, smallButtonClass } from "@/components/ui";
import util from "@/lib/util.json";
import { getBottlenecks, getSummary } from "../services/aiService";
import { aiFailure, type AiState } from "../state";
import type { AiAnswer, SummaryPeriod } from "../types";
import { AiBadge, AiNotice, AiText, AiUnavailable, SourceChips } from "./AiShared";

const t = util.ai.summary;

/**
 * Resumo do andamento e gargalos (funções de gestão: só o gerente do
 * projeto). O resumo pode ser filtrado pelo prazo das tarefas.
 */
export function SummaryPanel({
  projectId,
  onOpenTask,
}: {
  projectId: number;
  onOpenTask: (taskId: number) => void;
}) {
  const [period, setPeriod] = useState<SummaryPeriod>({});
  const [draft, setDraft] = useState<SummaryPeriod>({});
  const [periodError, setPeriodError] = useState("");
  const [summary, setSummary] = useState<AiState<AiAnswer>>({ status: "loading" });
  const [bottlenecks, setBottlenecks] = useState<AiState<AiAnswer>>({ status: "loading" });

  const load = useCallback(() => {
    let active = true;
    setSummary({ status: "loading" });
    setBottlenecks({ status: "loading" });
    getSummary(projectId, period)
      .then((data) => active && setSummary({ status: "success", data }))
      .catch((error) => active && setSummary(aiFailure(error, t.error)));
    getBottlenecks(projectId)
      .then((data) => active && setBottlenecks({ status: "success", data }))
      .catch((error) => active && setBottlenecks(aiFailure(error, t.bottlenecksError)));
    return () => {
      active = false;
    };
  }, [projectId, period]);

  useEffect(load, [load]);

  const applyPeriod = (event: FormEvent) => {
    event.preventDefault();
    // O backend exige as duas datas juntas (ou nenhuma).
    if (Boolean(draft.start) !== Boolean(draft.end)) {
      setPeriodError(t.periodBoth);
      return;
    }
    if (draft.start && draft.end && draft.start > draft.end) {
      setPeriodError(t.periodInvalid);
      return;
    }
    setPeriodError("");
    setPeriod({ ...draft });
  };

  const loading = summary.status === "loading" || bottlenecks.status === "loading";

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="summary-title" className="rounded-2xl border border-slate-200 bg-white p-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="summary-title" className="flex items-center gap-2 font-semibold text-slate-900">
            {t.title} <AiBadge />
          </h2>
          <button type="button" onClick={load} disabled={loading} className={smallButtonClass}>
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {t.refresh}
          </button>
        </header>

        <form onSubmit={applyPeriod} noValidate className="mt-4 flex flex-wrap items-end gap-2" aria-label={t.period}>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            {t.periodStart}
            <input
              type="date"
              value={draft.start ?? ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, start: e.target.value || undefined }))}
              className={`${inputClass} h-9 px-2 text-sm`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            {t.periodEnd}
            <input
              type="date"
              value={draft.end ?? ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, end: e.target.value || undefined }))}
              className={`${inputClass} h-9 px-2 text-sm`}
            />
          </label>
          <button type="submit" className={smallButtonClass}>
            {t.periodApply}
          </button>
          <p className={`w-full text-xs ${periodError ? "text-red-600" : "text-slate-500"}`} role={periodError ? "alert" : undefined}>
            {periodError || t.periodHint}
          </p>
        </form>

        <div className="mt-4">
          {summary.status === "loading" && <LoadingState label={t.loading} compact />}
          {summary.status === "unavailable" && <AiUnavailable message={t.unavailable} />}
          {summary.status === "error" && (
            <ErrorState title={t.error} message={summary.message} onRetry={load} compact />
          )}
          {summary.status === "success" && (
            <div className="flex flex-col gap-3">
              <AiNotice answer={summary.data} />
              <AiText text={summary.data.text} />
              <SourceChips sources={summary.data.sources} onOpenTask={onOpenTask} />
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="bottlenecks-title" className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 id="bottlenecks-title" className="flex items-center gap-2 font-semibold text-slate-900">
          {t.bottlenecksTitle} <AiBadge />
        </h2>
        <div className="mt-4">
          {bottlenecks.status === "loading" && <LoadingState label={t.bottlenecksLoading} compact />}
          {bottlenecks.status === "unavailable" && <AiUnavailable message={t.bottlenecksUnavailable} />}
          {bottlenecks.status === "error" && (
            <ErrorState title={t.bottlenecksError} message={bottlenecks.message} onRetry={load} compact />
          )}
          {bottlenecks.status === "success" && (
            <div className="flex flex-col gap-3">
              <AiNotice answer={bottlenecks.data} />
              <AiText text={bottlenecks.data.text} />
              <SourceChips sources={bottlenecks.data.sources} onOpenTask={onOpenTask} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
