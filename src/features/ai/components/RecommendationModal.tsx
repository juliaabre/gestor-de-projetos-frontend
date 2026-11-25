import { useCallback, useEffect, useId, useState } from "react";
import { Check, LoaderCircle, ThumbsDown } from "lucide-react";
import { Modal } from "@/components/Modal";
import { FormError } from "@/components/FeedbackBanner";
import { ErrorState, LoadingState } from "@/components/States";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { getErrorMessage } from "@/lib/apiError";
import { fillTemplate } from "@/lib/format";
import util from "@/lib/util.json";
import { Avatar } from "@/features/projects/components/Avatar";
import type { TeamMember } from "@/features/projects/types";
import { taskToInput } from "@/features/tasks/mappers";
import { updateTask } from "@/features/tasks/services/taskService";
import type { Task } from "@/features/tasks/types";
import { ComplexityBadge, TechList } from "@/features/tasks/components/TaskBadges";
import { recommendAssignees, registerDecision } from "../services/aiService";
import { aiFailure, type AiState } from "../state";
import type { RecommendationResult } from "../types";
import { AiBadge, AiUnavailable, ScoreBar, SourceChips } from "./AiShared";

const t = util.ai.recommendation;
const OTHER = "other";

export function RecommendationModal({
  task,
  team,
  onClose,
  onAssigned,
  onRejected,
}: {
  task: Task;
  team: TeamMember[];
  onClose: () => void;
  /** `warning` indica que a atribuição foi salva, mas a decisão não foi registrada. */
  onAssigned: (task: Task, assignee: TeamMember, warning?: string) => void;
  onRejected: () => void;
}) {
  const [state, setState] = useState<AiState<RecommendationResult>>({ status: "loading" });
  const [selected, setSelected] = useState<string>("");
  const [otherId, setOtherId] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const groupName = useId();

  const load = useCallback(() => {
    let active = true;
    setState({ status: "loading" });
    recommendAssignees(task.id)
      .then((data) => {
        if (!active) return;
        setState({ status: "success", data });
        setSelected(data.items[0] ? String(data.items[0].userId) : OTHER);
      })
      .catch((err) => active && setState(aiFailure(err, t.loadError)));
    return () => {
      active = false;
    };
  }, [task.id]);

  useEffect(load, [load]);

  const result = state.status === "success" ? state.data : null;
  const top = result?.items[0] ?? null;
  const rankedIds = new Set(result?.items.map((item) => item.userId) ?? []);
  const others = team.filter((member) => !rankedIds.has(member.id));
  const chosenId = selected === OTHER ? Number(otherId) || null : Number(selected) || null;
  const rankedChoice = result?.items.find((item) => item.userId === chosenId);
  const chosen: TeamMember | null =
    team.find((member) => member.id === chosenId) ??
    (rankedChoice ? { id: rankedChoice.userId, username: rankedChoice.username, email: "" } : null);

  const assign = async () => {
    if (!chosen) return;
    setPending(true);
    setError("");
    let saved: Task;
    try {
      saved = await updateTask(task.id, taskToInput(task, { assigneeId: chosen.id }));
    } catch (err) {
      setError(getErrorMessage(err, t.assignError));
      setPending(false);
      return;
    }
    let warning: string | undefined;
    if (result) {
      try {
        await registerDecision({
          taskId: task.id,
          recommendationId: result.recommendationId,
          decision: top && top.userId === chosen.id ? "ACCEPTED" : "ADJUSTED",
          recommendedUserId: top?.userId ?? null,
          chosenUserId: chosen.id,
        });
      } catch {
        warning = t.decisionNotRecorded;
      }
    }
    onAssigned(saved, chosen, warning);
  };

  const reject = async () => {
    if (!result) return;
    setPending(true);
    setError("");
    try {
      await registerDecision({
        taskId: task.id,
        recommendationId: result.recommendationId,
        decision: "REJECTED",
        recommendedUserId: top?.userId ?? null,
        chosenUserId: null,
        reason: reason.trim(),
      });
      onRejected();
    } catch (err) {
      setError(getErrorMessage(err, t.rejectError));
      setPending(false);
    }
  };

  const manualPicker = (
    <label className="mt-3 flex flex-col gap-2 text-sm font-medium text-slate-700">
      {t.manualLabel}
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={otherId}
          onChange={(e) => {
            setOtherId(e.target.value);
            setSelected(OTHER);
          }}
          className={`${inputClass} h-10 text-sm`}
        >
          <option value="">{t.selectMember}</option>
          {(state.status === "success" ? others : team).map((member) => (
            <option key={member.id} value={member.id}>
              {member.username}
            </option>
          ))}
        </select>
      </div>
    </label>
  );

  return (
    <Modal title={t.title} description={task.title} onClose={pending ? () => {} : onClose} size="lg">
      <div className="flex flex-col gap-5">
        <div className="rounded-xl bg-slate-50 p-4">
          {task.content && <p className="line-clamp-3 text-sm text-slate-600">{task.content}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <TechList technologies={task.technologies} />
            <ComplexityBadge complexity={task.complexity} />
          </div>
        </div>

        <FormError message={error} />

        {state.status === "loading" && <LoadingState label={t.loading} compact />}

        {state.status === "error" && (
          <ErrorState title={t.loadError} message={state.message} onRetry={load} compact />
        )}

        {state.status === "unavailable" && (
          <AiUnavailable message={t.unavailable}>{manualPicker}</AiUnavailable>
        )}

        {result && result.items.length === 0 && (
          <AiUnavailable message={t.empty}>{manualPicker}</AiUnavailable>
        )}

        {result && result.items.length > 0 && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 flex w-full flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
              {t.ranking} <AiBadge />
            </legend>
            {result.fallback && (
              <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {t.fallback}
              </p>
            )}
            <ol className="flex flex-col gap-2">
              {result.items.map((item, index) => {
                const checked = selected === String(item.userId);
                return (
                  <li key={item.userId}>
                    <label
                      className={`block cursor-pointer rounded-xl border p-3 transition ${
                        checked ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name={groupName}
                          value={item.userId}
                          checked={checked}
                          onChange={() => setSelected(String(item.userId))}
                          className="size-4 accent-blue-600"
                        />
                        <span className="text-xs font-semibold text-slate-500">#{index + 1}</span>
                        <Avatar name={item.username} className="size-7 text-[10px]" />
                        <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{item.username}</span>
                        <span className={`text-sm font-semibold ${index === 0 ? "text-blue-700" : "text-slate-600"}`}>
                          {item.score}%
                        </span>
                      </div>
                      <div className="mt-2 pl-7">
                        <ScoreBar score={item.score} highlight={index === 0} />
                        {item.justification && <p className="mt-2 text-sm text-slate-700">{item.justification}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600">
                          {item.currentLoad != null && (
                            <span>{fillTemplate(t.load, { count: item.currentLoad })}</span>
                          )}
                          {item.skills.length > 0 && (
                            <span className="flex flex-wrap items-center gap-1">
                              <span>{t.skills}:</span>
                              <TechList technologies={item.skills} />
                            </span>
                          )}
                        </div>
                        {item.sources.length > 0 && (
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-900">
                              {fillTemplate(t.viewSources, { count: item.sources.length })}
                            </summary>
                            <div className="mt-2">
                              <SourceChips sources={item.sources} />
                            </div>
                          </details>
                        )}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ol>

            {others.length > 0 && (
              <label
                className={`flex flex-col gap-2 rounded-xl border p-3 text-sm ${
                  selected === OTHER ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200"
                }`}
              >
                <span className="flex items-center gap-3 font-medium text-slate-700">
                  <input
                    type="radio"
                    name={groupName}
                    value={OTHER}
                    checked={selected === OTHER}
                    onChange={() => setSelected(OTHER)}
                    className="size-4 accent-blue-600"
                  />
                  {t.adjust}
                </span>
                <select
                  value={otherId}
                  onChange={(e) => {
                    setOtherId(e.target.value);
                    setSelected(OTHER);
                  }}
                  aria-label={t.manualLabel}
                  className={`${inputClass} h-10 text-sm`}
                >
                  <option value="">{t.selectMember}</option>
                  {others.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.username}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>
        )}

        {rejecting && result && (
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              {t.rejectReason}
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={t.rejectPlaceholder}
                className={`${inputClass} resize-y py-2 text-sm`}
              />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setRejecting(false)} disabled={pending} className={secondaryButtonClass}>
                {util.common.cancel}
              </button>
              <button type="button" onClick={reject} disabled={pending} className={`${primaryButtonClass} bg-slate-800 hover:bg-slate-900`}>
                {pending && <LoaderCircle className="size-4 animate-spin" />}
                {t.confirmReject}
              </button>
            </div>
          </div>
        )}

        {!rejecting && state.status !== "loading" && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={pending} className={secondaryButtonClass}>
              {util.common.cancel}
            </button>
            {result && result.items.length > 0 && (
              <button type="button" onClick={() => setRejecting(true)} disabled={pending} className={secondaryButtonClass}>
                <ThumbsDown className="size-4" /> {t.reject}
              </button>
            )}
            <button type="button" onClick={assign} disabled={!chosen || pending} className={primaryButtonClass}>
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
              {chosen ? fillTemplate(t.assignTo, { name: chosen.username }) : t.assign}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
