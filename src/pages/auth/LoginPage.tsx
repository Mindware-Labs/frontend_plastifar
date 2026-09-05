import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { AuthAlert } from "../../components/auth/AuthAlert";
import { AuthButton } from "../../components/auth/AuthButton";
import { AuthField, AuthPasswordField } from "../../components/auth/AuthField";
import { AuthToast } from "../../components/auth/AuthToast";
import { useAuth } from "../../context/useAuth";
import { AuthLayout } from "../../layouts/AuthLayout";

const schema = z.object({
  email: z.string().min(1, "Ingresa tu correo").email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

type FormValues = z.infer<typeof schema>;

// El servidor limita a 30 intentos por 5 minutos y por IP, y no devuelve
// Retry-After. Se refleja aqui esa misma ventana para poder decir cuanto falta
// en vez de dejar el formulario fallando en silencio.
const LOCKOUT_SECONDS = 5 * 60;

function formatCountdown(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const [lockoutLeft, setLockoutLeft] = useState(0);

  useEffect(() => {
    if (lockoutLeft <= 0) return;
    const timer = setTimeout(() => setLockoutLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [lockoutLeft]);

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
      // 429 no es "credenciales incorrectas": repetir el intento no arregla
      // nada hasta que la ventana pase, y hay que decirlo explicitamente.
      if (err instanceof ApiError && err.status === 429) {
        setLockoutLeft(LOCKOUT_SECONDS);
        setFormError(
          "Demasiados intentos desde esta conexión. Espera unos minutos antes de volver a probar.",
        );
        return;
      }
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
            <span className="font-heading text-[9.5px] font-semibold uppercase tracking-[0.22em] text-faint">
              Acceso restringido
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <p className="mt-4 text-center text-[12.5px] leading-relaxed text-muted">
            ¿Aún no tienes acceso?{" "}
            <span className="font-medium text-brand-gray">Solicítalo a tu administrador.</span>
          </p>
        </>
      }
    >
      <AuthToast message={formError} onDismiss={() => setFormError(null)} />

      {lockoutLeft > 0 && (
        <div className="mb-4">
          <AuthAlert>
            Demasiados intentos desde esta conexión. Podrás volver a intentarlo en{" "}
            <span className="tabular-nums">{formatCountdown(lockoutLeft)}</span>.
          </AuthAlert>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
        <AuthField
          label="Correo corporativo"
          placeholder="nombre@plastifar.com"
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
              className="ml-auto rounded text-[12.5px] font-medium text-muted underline-offset-4 transition-colors hover:text-brand-red hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          }
          {...register("password")}
        />

        <AuthButton
          type="submit"
          isLoading={isSubmitting}
          disabled={lockoutLeft > 0}
          className="mt-1.5"
        >
          {lockoutLeft > 0
            ? `Reintentar en ${formatCountdown(lockoutLeft)}`
            : isSubmitting
              ? "Verificando…"
              : "Entrar"}
        </AuthButton>
      </form>
    </AuthLayout>
  );
}
