import { LogOut, PanelsTopLeft } from "lucide-react";
import util from "@/lib/util.json";

export function Header({
  user,
  logout,
}: {
  user: { username: string; email: string } | null;
  logout: () => void;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-3 font-semibold text-slate-900">
          <span className="grid size-8 place-items-center rounded-lg bg-blue-600 text-white">
            <PanelsTopLeft />
          </span>{" "}
          {util.brand.name}
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-800">{user?.username}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label={util.navigation.logout}
          >
            <LogOut />
          </button>
        </div>
      </div>
    </header>
  );
}
