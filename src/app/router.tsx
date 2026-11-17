import { Navigate, Outlet, createBrowserRouter } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/AuthContext";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import util from "@/lib/util.json";

function ProtectedRoute() {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
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
    children: [{ path: "/dashboard", element: <DashboardPage /> }],
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
        </div>
      </main>
    ),
  },
  { path: "*", element: <Navigate to="/login" replace /> },
]);
