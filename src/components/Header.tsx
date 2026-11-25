import { LogOut, PanelsTopLeft } from "lucide-react";
import { NavLink } from "react-router-dom";
import util from "@/lib/util.json";
import type { UserRole } from "@/features/auth/types";

export function Header({
  user,
  logout,
}: {
  user: { username: string; email: string; roles?: UserRole[] } | null;
  logout: () => void;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {util.navigation.skipToContent}
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 font-semibold text-slate-900">
          <span className="grid size-8 place-items-center rounded-lg bg-blue-600 text-white">
            <PanelsTopLeft aria-hidden="true" />
          </span>{" "}
          <span className="hidden sm:inline">{util.brand.name}</span>
          <nav aria-label={util.navigation.main} className="ml-2 flex min-w-0 gap-1 overflow-x-auto sm:ml-6">
            {[
              ["/dashboard", util.navigation.dashboard],
              ["/projects", util.navigation.projects],
              ...(user?.roles?.includes("ADMIN") ? [["/admin/conhecimento", util.navigation.knowledge]] : []),
            ].map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-800">{user?.username}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label={util.navigation.logout}
          >
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
