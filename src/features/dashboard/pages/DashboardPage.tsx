import { Link, useNavigate } from "react-router-dom";
import { FolderKanban, LoaderCircle, PanelsTopLeft, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/AuthContext";
import { useProjects } from "@/features/projects/hooks/useProjects";
import type { ProjectsPageState } from "@/features/projects/pages/ProjectsPage";
import util from "@/lib/util.json";
import { Header } from "../../../../components/header";

const t = util.dashboard.projects;

const PREVIEW = 4;

function ProjectsPreview() {
  const { state, reload } = useProjects();

  if (state.status === "error")
    return (
      <div role="alert" className="mt-10 rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        <p>{state.message}</p>
        <button onClick={reload} className="mt-2 font-semibold underline">
          {t.retry}
        </button>
      </div>
    );

  if (state.status === "loading")
    return (
      <p className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="animate-spin" /> {t.loading}
      </p>
    );

  const activeProjects = state.projects.filter((project) => !project.archived);
  if (activeProjects.length === 0)
    return (
      <div className="mt-10 rounded-xl border border-dashed border-slate-200 p-10 text-center">
        <p className="font-medium text-slate-700">{t.emptyTitle}</p>
        <p className="mt-1 text-sm text-slate-500">{t.emptyDescription}</p>
      </div>
    );

  return (
    <>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {activeProjects.slice(0, PREVIEW).map((project) => (
          <li key={project.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <FolderKanban className="size-4 shrink-0 text-blue-600" />
              <span className="truncate">{project.name}</span>
            </div>
            {project.description && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{project.description}</p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              {t.tasksCount.replace("{count}", String(project.taskIds.length))}
              {" · "}
              {t.membersCount.replace("{count}", String(project.team.length))}
            </p>
          </li>
        ))}
      </ul>
      <Link to="/projects" className="mt-5 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
        {t.viewAll} →
      </Link>
    </>
  );
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
          <button
            type="button"
            onClick={() => navigate("/projects", { state: { openCreate: true } satisfies ProjectsPageState })}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">
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
            <ProjectsPreview />
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
