import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/States";
import { smallButtonClass } from "@/components/ui";
import { fillTemplate, formatDateTime } from "@/lib/format";
import util from "@/lib/util.json";
import { getBottlenecks, getSummary } from "../services/aiService";
import { aiFailure, type AiState } from "../state";
import type { Bottleneck, ProjectSummary, SummaryScope } from "../types";
import { AiBadge, AiUnavailable, BottleneckAlert, SourceChips } from "./AiShared";

const t = util.ai.summary;

export function SummaryPanel({
  projectId,
  onOpenTask,
}: {
  projectId: number;
  onOpenTask: (taskId: number) => void;
}) {
  const [scope, setScope] = useState<SummaryScope>("PROJECT");
  const [summary, setSummary] = useState<AiState<ProjectSummary>>({ status: "loading" });
  const [bottlenecks, setBottlenecks] = useState<AiState<Bottleneck[]>>({ status: "loading" });

  const load = useCallback(
    (refresh: boolean) => {
      let active = true;
      setSummary({ status: "loading" });
      setBottlenecks({ status: "loading" });
      getSummary(projectId, scope, refresh)
        .then((data) => active && setSummary({ status: "success", data }))
        .catch((error) => active && setSummary(aiFailure(error, t.error)));
      getBottlenecks(projectId)
        .then((data) => active && setBottlenecks({ status: "success", data }))
        .catch((error) => active && setBottlenecks(aiFailure(error, t.bottlenecksError)));
      return () => {
        active = false;
      };
    },
    [projectId, scope],
  );

  useEffect(() => load(false), [load]);

  const loading = summary.status === "loading" || bottlenecks.status === "loading";

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="summary-title" className="rounded-2xl border border-slate-200 bg-white p-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="summary-title" className="flex items-center gap-2 font-semibold text-slate-900">
            {t.title} <AiBadge />
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as SummaryScope)}
              aria-label={t.scope}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
            >
              <option value="PROJECT">{t.scopeProject}</option>
              <option value="SPRINT">{t.scopeSprint}</option>
            </select>
            <button type="button" onClick={() => load(true)} disabled={loading} className={smallButtonClass}>
              {loading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {t.refresh}
            </button>
          </div>
        </header>

        <div className="mt-4">
          {summary.status === "loading" && <LoadingState label={t.loading} compact />}
          {summary.status === "unavailable" && <AiUnavailable message={t.unavailable} />}
          {summary.status === "error" && (
            <ErrorState title={t.error} message={summary.message} onRetry={() => load(false)} compact />
          )}
          {summary.status === "success" && (
            <div className="flex flex-col gap-3">
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{summary.data.summary}</p>
              <SourceChips sources={summary.data.sources} onOpenTask={onOpenTask} />
              {summary.data.generatedAt && (
                <p className="text-xs text-slate-500">
                  {fillTemplate(t.generatedAt, { date: formatDateTime(summary.data.generatedAt) })}
                </p>
              )}
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
            <ErrorState title={t.bottlenecksError} message={bottlenecks.message} onRetry={() => load(false)} compact />
          )}
          {bottlenecks.status === "success" && bottlenecks.data.length === 0 && (
            <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="size-4" aria-hidden="true" /> {t.noBottlenecks}
            </p>
          )}
          {bottlenecks.status === "success" && bottlenecks.data.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label={t.bottlenecksTitle}>
              {bottlenecks.data.map((bottleneck, index) => (
                <li key={index}>
                  <BottleneckAlert bottleneck={bottleneck} onOpenTask={onOpenTask} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
