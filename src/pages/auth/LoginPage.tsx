import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { AuthAlert } from "../../components/auth/AuthAlert";
import { AuthButton } from "../../components/auth/AuthButton";
import { AuthField, AuthPasswordField } from "../../components/auth/AuthField";
import { useAuth } from "../../context/AuthContext";
import { AuthLayout } from "../../layouts/AuthLayout";

const schema = z.object({
  email: z.string().min(1, "Ingresa tu correo").email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const from = (location.state as { from?: string } | null)?.from ?? "/staff";

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await login(values.email, values.password);
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    }
  }

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Panel interno de Plastifar, S.A."
      footer={
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="font-heading text-[9.5px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
              Acceso restringido
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <p className="mt-4 text-center text-[12.5px] leading-relaxed text-zinc-500">
            ¿Aún no tienes acceso?{" "}
            <span className="font-medium text-brand-gray">Solicítalo a tu administrador.</span>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
        {formError && <AuthAlert>{formError}</AuthAlert>}

        <AuthField
          label="Correo corporativo"
          placeholder="Correo corporativo"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoFocus
          icon={<Mail className="h-[18px] w-[18px]" />}
          error={errors.email?.message}
          {...register("email")}
        />

        <AuthPasswordField
          label="Contraseña"
          autoComplete="current-password"
          icon={<Lock className="h-[18px] w-[18px]" />}
          error={errors.password?.message}
          action={
            <Link
              to="/forgot-password"
              className="ml-auto rounded text-[12.5px] font-medium text-zinc-500 underline-offset-4 transition-colors hover:text-brand-red hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          }
          {...register("password")}
        />

        <AuthButton type="submit" isLoading={isSubmitting} className="mt-1.5">
          {isSubmitting ? "Verificando…" : "Entrar"}
        </AuthButton>
      </form>
    </AuthLayout>
  );
}
