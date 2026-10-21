import { PanelsTopLeft, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/AuthContext";
import util from "@/lib/util.json";
import { Header } from "../../../../components/header";

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
                user?.name?.split(" ")[0] || util.dashboard.fallbackName,
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
            <div className="mt-10 rounded-xl border border-dashed border-slate-200 p-10 text-center">
              <p className="font-medium text-slate-700">
                {util.dashboard.projects.emptyTitle}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {util.dashboard.projects.emptyDescription}
              </p>
            </div>
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
