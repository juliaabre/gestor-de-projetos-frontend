import { useId, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import util from "@/lib/util.json";
import { fillTemplate } from "@/lib/format";

const t = util.common.tags;

export function TagInput({
  label,
  value,
  onChange,
  placeholder,
  error,
  maxTags = 15,
  maxLength = 40,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  error?: string;
  maxTags?: number;
  maxLength?: number;
}) {
  const inputId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState("");

  const add = () => {
    const term = draft.trim().replace(/,$/, "").trim();
    if (!term) return;
    if (term.length > maxLength) {
      setLocalError(fillTemplate(t.tooLong, { max: maxLength }));
      return;
    }
    if (value.some((tag) => tag.toLowerCase() === term.toLowerCase())) {
      setLocalError(t.duplicate);
      return;
    }
    if (value.length >= maxTags) {
      setLocalError(fillTemplate(t.tooMany, { max: maxTags }));
      return;
    }
    onChange([...value, term]);
    setDraft("");
    setLocalError("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    } else if (event.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const message = localError || error;

  return (
    <div className="flex flex-col gap-2 text-sm font-medium text-slate-700">
      <label htmlFor={inputId}>{label}</label>
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-xl border bg-white px-2 py-1.5 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 ${
          message ? "border-red-400" : "border-slate-200"
        }`}
      >
        {value.length > 0 && (
          <ul className="contents" aria-label={label}>
            {value.map((tag) => (
              <li
                key={tag}
                className="flex items-center gap-1 rounded-lg bg-slate-100 py-1 pl-2.5 pr-1 text-xs font-medium text-slate-700"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((item) => item !== tag))}
                  aria-label={fillTemplate(t.remove, { tag })}
                  className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          id={inputId}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setLocalError("");
          }}
          onKeyDown={onKeyDown}
          onBlur={add}
          placeholder={value.length === 0 ? placeholder : ""}
          aria-describedby={hintId}
          aria-invalid={Boolean(message)}
          className="h-8 min-w-32 flex-1 bg-transparent px-1.5 font-normal text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>
      <span id={hintId} className={message ? "text-xs font-normal text-red-600" : "text-xs font-normal text-slate-500"}>
        {message || t.hint}
      </span>
    </div>
  );
}
