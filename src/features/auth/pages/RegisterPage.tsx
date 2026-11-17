import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, UserPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { registerSchema, type RegisterFormData } from "../schemas/registerSchema";
import { useAuth } from "../hooks/AuthContext";
import { AuthLayout, inputClassName, submitClassName } from "../components/AuthLayout";
import util from "@/lib/util.json";

const t = util.auth.register;

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError("");
    try {
      await registerUser(data);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response)
        setServerError(t.errors.serverUnavailable);
      // E-mail duplicado gera erro de integridade no banco; o backend ainda não
      // devolve 409, então qualquer 4xx/5xx aqui provavelmente é isso.
      else if (axios.isAxiosError(error)) setServerError(t.errors.conflict);
      else setServerError(t.errors.generic);
    }
  };

  return (
    <AuthLayout title={t.title} description={t.description}>
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
          {t.fields.username.label}
          <input
            {...register("username")}
            autoComplete="username"
            placeholder={t.fields.username.placeholder}
            aria-invalid={Boolean(errors.username)}
            className={inputClassName}
          />
          {errors.username && (
            <span className="text-xs font-normal text-red-600">
              {errors.username.message}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          {t.fields.email.label}
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            placeholder={t.fields.email.placeholder}
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
          {t.fields.password.label}
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={t.fields.password.placeholder}
              aria-invalid={Boolean(errors.password)}
              className={`${inputClassName} pr-12`}
            />
            <button
              type="button"
              aria-label={showPassword ? t.fields.password.hide : t.fields.password.show}
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
              {t.actions.submitting}
            </>
          ) : (
            <>
              <UserPlus /> {t.actions.submit}
            </>
          )}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        {t.switch.prompt}{" "}
        <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700">
          {t.switch.action}
        </Link>
      </p>
    </AuthLayout>
  );
}
