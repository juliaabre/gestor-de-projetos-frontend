import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import util from "@/lib/util.json";

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden bg-blue-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="flex items-center gap-3 text-lg font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-white/15">
              <ShieldCheck />
            </span>{" "}
            {util.brand.name}
          </div>
          <div className="mt-28 max-w-lg">
            <p className="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-blue-100">
              {util.auth.login.marketing.eyebrow}
            </p>
            <h1 className="text-5xl font-semibold leading-tight tracking-tight">
              {util.auth.login.marketing.headline}
            </h1>
            <p className="mt-6 text-lg leading-8 text-blue-100">
              {util.auth.login.marketing.description}
            </p>
          </div>
        </div>
        <p className="text-sm text-blue-100">
          {util.auth.login.marketing.platform}
        </p>
      </section>
      <section className="flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <div className="flex items-center gap-3 text-xl font-semibold text-slate-900">
              <span className="grid size-9 place-items-center rounded-xl bg-blue-600 text-white">
                <ShieldCheck />
              </span>{" "}
              {util.brand.name}
            </div>
          </div>
          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            <p className="mt-2 text-slate-500">{description}</p>
          </div>
          {children}
          <p className="mt-8 text-center text-xs leading-5 text-slate-400">
            {util.auth.login.footer}
          </p>
        </div>
      </section>
    </main>
  );
}

export const inputClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-normal outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

export const submitClassName =
  "mt-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70";
