import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole, LoaderCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { loginSchema, type LoginFormData } from "../schemas/loginSchema";
import { useAuth } from "../hooks/AuthContext";
import {
  AuthLayout,
  inputClassName,
  submitClassName,
} from "../components/AuthLayout";
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
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;

      if (status === 401 || status === 403)
        setServerError(util.auth.login.errors.invalidCredentials);
      else if (axios.isAxiosError(error) && !error.response)
        setServerError(util.auth.login.errors.serverUnavailable);
      else setServerError(util.auth.login.errors.generic);
    }
  };
  return (
    <AuthLayout
      title={util.auth.login.welcome.title}
      description={util.auth.login.welcome.description}
    >
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
            className={inputClassName}
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
              className={`${inputClassName} pr-12`}
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
        <button disabled={isLoading} className={submitClassName}>
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
      <p className="mt-6 text-center text-sm text-slate-500">
        {util.auth.login.switch.prompt}{" "}
        <Link
          to="/register"
          className="font-semibold text-blue-600 hover:text-blue-700"
        >
          {util.auth.login.switch.action}
        </Link>
      </p>
    </AuthLayout>
  );
}
