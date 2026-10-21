import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { loginSchema, type LoginFormData } from "../schemas/loginSchema";
import { useAuth } from "../hooks/AuthContext";
import util from "@/lib/util.json";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });
  const onSubmit = async (data: LoginFormData) => {
    setServerError("");
    try {
      await login(data);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401)
        setServerError(util.auth.login.errors.invalidCredentials);
      else if (axios.isAxiosError(error) && !error.response)
        setServerError(util.auth.login.errors.serverUnavailable);
      else setServerError(util.auth.login.errors.generic);
    }
  };
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
              {util.auth.login.welcome.title}
            </h2>
            <p className="mt-2 text-slate-500">
              {util.auth.login.welcome.description}
            </p>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            noValidate
          >
            {serverError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {serverError}
              </div>
            )}
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              {util.auth.login.fields.email.label}
              <input
                {...register("email")}
                type="email"
                autoComplete="email"
                placeholder={util.auth.login.fields.email.placeholder}
                aria-invalid={Boolean(errors.email)}
                className="h-12 rounded-xl border border-slate-200 bg-white px-4 font-normal outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />

              {errors.email && (
                <span className="text-xs font-normal text-red-600">
                  {errors.email.message}
                </span>
              )}
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              {util.auth.login.fields.password.label}
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder={util.auth.login.fields.password.placeholder}
                  aria-invalid={Boolean(errors.password)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 font-normal outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
                <button
                  type="button"
                  aria-label={
                    showPassword
                      ? util.auth.login.fields.password.hide
                      : util.auth.login.fields.password.show
                  }
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {errors.password && (
                <span className="text-xs font-normal text-red-600">
                  {errors.password.message}
                </span>
              )}
            </label>
            <button
              disabled={isLoading}
              className="mt-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  {util.auth.login.actions.submitting}
                </>
              ) : (
                <>
                  <LockKeyhole /> {util.auth.login.actions.submit}
                </>
              )}
            </button>
          </form>
          <p className="mt-8 text-center text-xs leading-5 text-slate-400">
            {util.auth.login.footer}
          </p>
        </div>
      </section>
    </main>
  );
}
