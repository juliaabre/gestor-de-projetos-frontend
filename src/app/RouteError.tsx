import { Link, useRouteError } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import util from "@/lib/util.json";

const t = util.access.crash;

/**
 * Exibida quando uma tela lança um erro inesperado (ou o código dela não
 * carrega). Mantém a aplicação utilizável em vez de deixar a página em branco.
 */
export function RouteError() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <div role="alert" className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center">
        <TriangleAlert className="mx-auto text-red-600" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-semibold text-slate-900">{t.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t.description}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {t.reload}
          </button>
          <Link
            to="/dashboard"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50"
          >
            {t.back}
          </Link>
        </div>
      </div>
    </main>
  );
}
