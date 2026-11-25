import { useState } from "react";
import { FlaskConical, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/AuthContext";
import { DEMO_PASSWORD, db, resetDb } from "./db";
import { getAiMode, setAiMode, type AiMode } from "./settings";

const AI_MODES: { value: AiMode; label: string; hint: string }[] = [
  { value: "normal", label: "Funcionando", hint: "Todas as funções de IA respondem." },
  { value: "fallback", label: "Sem síntese (alternativa)", hint: "Como o backend sem a chave do Gemini: respostas extrativas com aviso e pontuação calculada no servidor." },
  { value: "offline", label: "Fora do ar", hint: "Rotas /api/ia e a indexação de documentos respondem 503." },
];

const ROLE_LABEL: Record<string, string> = { ADMINISTRADOR: "Admin", MEMBRO: "Membro" };

/** Painel flutuante do modo de simulação: troca de usuário, estado da IA e reset dos dados. */
export function MockControls() {
  const { user, login } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AiMode>(getAiMode);
  const [switching, setSwitching] = useState<string | null>(null);

  const loginAs = async (email: string) => {
    setSwitching(email);
    try {
      await login({ email, password: DEMO_PASSWORD });
      window.location.assign("/dashboard");
    } finally {
      setSwitching(null);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-[60] flex items-center gap-2 rounded-full bg-violet-700 px-3.5 py-2 text-xs font-semibold text-white shadow-lg hover:bg-violet-800"
      >
        <FlaskConical className="size-4" /> Simulação
      </button>
    );
  }

  return (
    <aside
      aria-label="Controles da simulação"
      className="fixed bottom-4 left-4 z-[60] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-violet-200 bg-white p-4 text-sm shadow-2xl"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-semibold text-violet-800">
            <FlaskConical className="size-4" /> Modo simulação
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Backend falso em memória. Nada é enviado a um servidor.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
          <X className="size-4" />
        </button>
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Entrar como (senha {DEMO_PASSWORD})</p>
      <ul className="mt-2 flex flex-col gap-1">
        {db.users.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => loginAs(u.email)}
              disabled={switching != null || user?.email === u.email}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-50 disabled:cursor-default disabled:bg-violet-50"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium text-slate-800">{u.username}</span>{" "}
                <span className="text-xs text-slate-500">{u.email}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-600">
                {switching === u.email && <LoaderCircle className="size-3 animate-spin" />}
                {user?.email === u.email ? "atual" : [
                      ...u.roles.filter((r) => r !== "MEMBRO").map((r) => ROLE_LABEL[r]),
                      ...db.projects.filter((p) => p.gerenteId === u.id && !p.arquivado).map((p) => `gerente de ${p.nome}`),
                    ].join(" · ") || ROLE_LABEL.MEMBRO}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <fieldset className="mt-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado da IA</legend>
        <div className="mt-2 flex flex-col gap-1">
          {AI_MODES.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-1.5 hover:bg-slate-50">
              <input
                type="radio"
                name="mock-ai-mode"
                checked={mode === option.value}
                onChange={() => {
                  setAiMode(option.value);
                  setMode(option.value);
                }}
                className="mt-0.5 accent-violet-600"
              />
              <span>
                <span className="font-medium text-slate-800">{option.label}</span>
                <span className="block text-xs text-slate-500">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={() => {
          resetDb();
          window.location.reload();
        }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <RotateCcw className="size-3.5" /> Restaurar dados de exemplo
      </button>
    </aside>
  );
}
