import { Suspense, lazy, type ReactNode } from "react";
import { Link, Navigate, Outlet, createBrowserRouter } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/AuthContext";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { LoadingState } from "@/components/States";
import util from "@/lib/util.json";
import { RouteError } from "./RouteError";

// Telas mais pesadas são carregadas sob demanda, para que login e início
// abram rápido (meta de até 2 s).
const ProjectsPage = lazy(() =>
  import("@/features/projects/pages/ProjectsPage").then((m) => ({
    default: m.ProjectsPage,
  })),
);
const ProjectBoardPage = lazy(() =>
  import("@/features/projects/pages/ProjectBoardPage").then((m) => ({
    default: m.ProjectBoardPage,
  })),
);
const KnowledgeBasePage = lazy(() =>
  import("@/features/admin/pages/KnowledgeBasePage").then((m) => ({
    default: m.KnowledgeBasePage,
  })),
);

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50">
          <LoadingState label={util.access.loadingPage} />
        </main>
      }
    >
      {children}
    </Suspense>
  );
}

function ProtectedRoute() {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
/** Base de conhecimento e regras de domínio: somente perfil Administrador. */
export function AdminRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.roles.includes("ADMIN") ? (
    <Outlet />
  ) : (
    <Navigate to="/unauthorized" replace />
  );
}
function PublicRoute() {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <PublicRoute />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/register", element: <RegisterPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "/dashboard", element: <DashboardPage /> },
          {
            path: "/projects",
            element: (
              <Lazy>
                <ProjectsPage />
              </Lazy>
            ),
          },
          {
            path: "/projects/:projectId",
            element: (
              <Lazy>
                <ProjectBoardPage />
              </Lazy>
            ),
          },
        ],
      },
      {
        element: <AdminRoute />,
        children: [
          {
            path: "/admin/conhecimento",
            element: (
              <Lazy>
                <KnowledgeBasePage />
              </Lazy>
            ),
          },
        ],
      },
      {
        path: "/unauthorized",
        element: (
          <main className="grid min-h-screen place-items-center p-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold">
                {util.access.unauthorized.title}
              </h1>
              <p className="mt-2 text-slate-600">
                {util.access.unauthorized.description}
              </p>
              <Link
                to="/dashboard"
                className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {util.access.unauthorized.back}
              </Link>
            </div>
          </main>
        ),
      },
      { path: "*", element: <Navigate to="/login" replace /> },
    ],
  },
]);
