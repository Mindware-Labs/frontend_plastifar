import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail, ShieldCheck } from "lucide-react";
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
    <AuthLayout title="Iniciar sesión" subtitle="Accede al panel interno de Plastifar">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {formError && <AuthAlert>{formError}</AuthAlert>}

        <AuthField
          label="Correo corporativo"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoFocus
          icon={<Mail className="h-[18px] w-[18px]" />}
          error={errors.email?.message}
          {...register("email")}
        />

        <div>
          <AuthPasswordField
            label="Contraseña"
            autoComplete="current-password"
            icon={<Lock className="h-[18px] w-[18px]" />}
            error={errors.password?.message}
            {...register("password")}
          />
          <div className="mt-3 flex justify-end">
            <Link
              to="/forgot-password"
              className="rounded text-[13px] font-medium text-brand-red underline-offset-4 transition-colors hover:text-brand-red-dark hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>

        <AuthButton type="submit" isLoading={isSubmitting} className="mt-1">
          {isSubmitting ? "Verificando…" : "Entrar"}
        </AuthButton>
      </form>

      <div className="mt-9 flex items-center gap-4">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-zinc-200" />
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-[0.14em] text-zinc-400">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Acceso restringido
        </span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-zinc-200" />
      </div>

      <p className="mt-5 text-center text-[13px] leading-relaxed text-zinc-500">
        Uso exclusivo del personal autorizado de Plastifar.
        <br />
        ¿Aún no tienes acceso?{" "}
        <span className="font-medium text-brand-gray">Solicítalo a tu administrador.</span>
      </p>
    </AuthLayout>
  );
}
