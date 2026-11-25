import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FolderKanban, Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { FeedbackBanner, useFeedback } from "@/components/FeedbackBanner";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { handleTabListKeyDown } from "@/components/tabs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/features/auth/hooks/AuthContext";
import { getErrorMessage } from "@/lib/apiError";
import util from "@/lib/util.json";
import { ProjectCard } from "../components/ProjectCard";
import { ProjectFormModal } from "../components/ProjectFormModal";
import { useProjects } from "../hooks/useProjects";
import { archiveProject, unarchiveProject } from "../services/projectService";
import type { Project } from "../types";
import { usePageTitle } from "@/lib/usePageTitle";

const t = util.projects;
type Tab = "active" | "archived";

export interface ProjectsPageState {
  openCreate?: boolean;
}

export function ProjectsPage() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, reload, upsert } = useProjects();
  usePageTitle(util.pages.projects);

  const [tab, setTab] = useState<Tab>("active");
  const [form, setForm] = useState<{ project?: Project } | null>(null);
  const [projectToArchive, setProjectToArchive] = useState<Project | null>(
    null,
  );
  const [unarchivingId, setUnarchivingId] = useState<number | null>(null);
  const { feedback, success, error: fail, clear } = useFeedback();

  useEffect(() => {
    if ((location.state as ProjectsPageState | null)?.openCreate) {
      setForm({});
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  const notify = (kind: "success" | "error", template: string, projectName = "") =>
    (kind === "success" ? success : fail)(template.replace("{name}", projectName));

  const handleUnarchive = async (project: Project) => {
    setUnarchivingId(project.id);
    try {
      const updated = await unarchiveProject(project.id);
      upsert(updated);
      notify("success", t.feedback.unarchived, updated.name);
    } catch (error) {
      notify("error", getErrorMessage(error, t.unarchive.error));
    } finally {
      setUnarchivingId(null);
    }
  };

  const projects = state.status === "success" ? state.projects : [];
  const activeProjects = projects.filter((project) => !project.archived);
  const archivedProjects = projects.filter((project) => project.archived);
  const visibleProjects = tab === "active" ? activeProjects : archivedProjects;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} logout={logout} />

      <main id="conteudo" tabIndex={-1} className="outline-none mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-blue-600">
              {t.page.eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {t.page.title}
            </h1>
            <p className="mt-2 text-slate-500">{t.page.description}</p>
          </div>
          <button
            type="button"
            onClick={() => setForm({})}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus /> {t.page.newProject}
          </button>
        </div>

        <FeedbackBanner feedback={feedback} onClose={clear} className="mt-6" />

        <div
          role="tablist"
          aria-label={t.tabs.label}
          onKeyDown={handleTabListKeyDown}
          className="mt-8 flex gap-1 border-b border-slate-200"
        >
          {(
            [
              ["active", t.tabs.active, activeProjects.length],
              ["archived", t.tabs.archived, archivedProjects.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`projects-tab-${key}`}
              aria-selected={tab === key}
              aria-controls="projects-panel"
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${
                tab === key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
              {state.status === "success" && (
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <section
          role="tabpanel"
          id="projects-panel"
          aria-labelledby={`projects-tab-${tab}`}
          className="mt-6"
        >
          {state.status === "loading" && <LoadingState label={t.list.loading} />}

          {state.status === "error" && (
            <ErrorState title={t.list.loadError} message={state.message} onRetry={reload} />
          )}

          {state.status === "success" && visibleProjects.length === 0 && (
            <EmptyState
              icon={<FolderKanban className="mx-auto text-slate-300" aria-hidden="true" />}
              title={tab === "active" ? t.list.emptyActiveTitle : t.list.emptyArchivedTitle}
              description={
                tab === "active" ? t.list.emptyActiveDescription : t.list.emptyArchivedDescription
              }
            />
          )}

          {state.status === "success" && visibleProjects.length > 0 && (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleProjects.map((project) => (
                <li key={project.id} className="flex">
                  <div className="flex w-full flex-col [&>article]:flex-1">
                    <ProjectCard
                      project={project}
                      onEdit={() => setForm({ project })}
                      onArchive={() => setProjectToArchive(project)}
                      onUnarchive={() => handleUnarchive(project)}
                      unarchiving={unarchivingId === project.id}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {form && (
        <ProjectFormModal
          project={form.project}
          currentUserId={user?.id}
          onClose={() => setForm(null)}
          onSaved={(saved, mode) => {
            setForm(null);
            upsert(saved);
            setTab(saved.archived ? "archived" : "active");
            notify(
              "success",
              mode === "created" ? t.feedback.created : t.feedback.updated,
              saved.name,
            );
          }}
        />
      )}

      {projectToArchive && (
        <ConfirmDialog
          title={t.archive.title}
          description={t.archive.description.replace(
            "{name}",
            projectToArchive.name,
          )}
          confirmLabel={t.archive.confirm}
          confirmingLabel={t.archive.confirming}
          getError={(error) => getErrorMessage(error, t.archive.error)}
          onClose={() => setProjectToArchive(null)}
          onConfirm={async () => {
            const updated = await archiveProject(projectToArchive.id);
            upsert(updated);
            setProjectToArchive(null);
            notify("success", t.feedback.archived, updated.name);
          }}
        />
      )}
    </div>
  );
}
