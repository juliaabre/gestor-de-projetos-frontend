import { useCallback, useEffect, useState } from "react";
import { FolderKanban, LoaderCircle, PanelsTopLeft, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/AuthContext";
import { listarProjetos } from "@/features/projetos/services/projetoService";
import type { Projeto } from "@/features/projetos/types";
import util from "@/lib/util.json";
import { Header } from "../../../../components/header";

const t = util.dashboard.projects;

function ProjetosList() {
  const [projetos, setProjetos] = useState<Projeto[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    setProjetos(null);
    listarProjetos()
      .then(setProjetos)
      .catch(() => setError(true));
  }, []);

  useEffect(load, [load]);

  if (error)
    return (
      <div role="alert" className="mt-10 rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        {t.error}{" "}
        <button onClick={load} className="font-semibold underline">
          {t.retry}
        </button>
      </div>
    );

  if (!projetos)
    return (
      <p className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="animate-spin" /> {t.loading}
      </p>
    );

  if (projetos.length === 0)
    return (
      <div className="mt-10 rounded-xl border border-dashed border-slate-200 p-10 text-center">
        <p className="font-medium text-slate-700">{t.emptyTitle}</p>
        <p className="mt-1 text-sm text-slate-500">{t.emptyDescription}</p>
      </div>
    );

  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-2">
      {projetos.map((projeto) => (
        <li key={projeto.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 font-medium text-slate-900">
            <FolderKanban className="size-4 text-blue-600" /> {projeto.nome}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t.tasksCount.replace("{count}", String(projeto.tarefasIds?.length ?? 0))}
            {" · "}
            {t.membersCount.replace("{count}", String(projeto.equipeIds?.length ?? 0))}
          </p>
          {projeto.createdAt && (
            <p className="mt-1 text-xs text-slate-400">
              {t.createdAt.replace("{date}", new Date(projeto.createdAt).toLocaleDateString("pt-BR"))}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} logout={logout} />

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-blue-600">
              {util.dashboard.eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {util.dashboard.greeting.replace(
                "{name}",
                user?.username?.split(" ")[0] || util.dashboard.fallbackName,
              )}
            </h1>
            <p className="mt-2 text-slate-500">{util.dashboard.description}</p>
          </div>
          <button className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus /> {util.dashboard.actions.newProject}
          </button>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                <PanelsTopLeft />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">
                  {util.dashboard.projects.title}
                </h2>
                <p className="text-sm text-slate-500">
                  {util.dashboard.projects.description}
                </p>
              </div>
            </div>
            <ProjetosList />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white">
            <Sparkles className="text-blue-300" />
            <h2 className="mt-8 text-xl font-semibold">
              {util.dashboard.evolution.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {util.dashboard.evolution.description}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
