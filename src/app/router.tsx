import { Link, Navigate, Outlet, createBrowserRouter } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/AuthContext";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { ProjectsPage } from "@/features/projects/pages/ProjectsPage";
import { ProjectBoardPage } from "@/features/projects/pages/ProjectBoardPage";
import { KnowledgeBasePage } from "@/features/admin/pages/KnowledgeBasePage";
import util from "@/lib/util.json";

function ProtectedRoute() {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
/** Base de conhecimento e regras de domínio: somente perfil Administrador. */
export function AdminRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.roles.includes("ADMIN") ? <Outlet /> : <Navigate to="/unauthorized" replace />;
}
function PublicRoute() {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
export const router = createBrowserRouter([
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
      { path: "/projects", element: <ProjectsPage /> },
      { path: "/projects/:projectId", element: <ProjectBoardPage /> },
    ],
  },
  {
    element: <AdminRoute />,
    children: [{ path: "/admin/conhecimento", element: <KnowledgeBasePage /> }],
  },
  {
    path: "/unauthorized",
    element: (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            {util.access.unauthorized.title}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {util.access.unauthorized.description}
          </p>
          <Link to="/dashboard" className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
            {util.access.unauthorized.back}
          </Link>
        </div>
      </main>
    ),
  },
  { path: "*", element: <Navigate to="/login" replace /> },
]);
