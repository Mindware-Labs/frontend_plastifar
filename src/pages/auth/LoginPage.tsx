import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Lock, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { AuthButton } from "../../components/auth/AuthButton";
import { AuthField, AuthPasswordField } from "../../components/auth/AuthField";
import { useAuth } from "../../context/useAuth";
import { AuthLayout } from "../../layouts/AuthLayout";

const schema = z.object({
  email: z.string().min(1, "Ingresa tu correo").email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

type FormValues = z.infer<typeof schema>;

type Phase = "idle" | "mismatch" | "deactivated" | "limited" | "failed";

const toneLabels: Record<Exclude<Phase, "idle">, string> = {
  mismatch: "Contraseña o correo incorrecto",
  deactivated: "Cuenta desactivada",
  limited: "Demasiados intentos",
  failed: "No se pudo entrar",
};

const SETTLE_MS = 340;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [attempt, setAttempt] = useState(0);
  const [settle, setSettle] = useState(false);
  const [relayKey, setRelayKey] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [stale, setStale] = useState<FormValues | null>(null);
  const [emailBlurError, setEmailBlurError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!settle) return;
    const timer = window.setTimeout(() => setSettle(false), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [settle]);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const requested = (location.state as { from?: string } | null)?.from;
  const from = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";

  function fail(next: Exclude<Phase, "idle">, values: FormValues, text: string) {
    setStale(values);
    setPhase(next);
    setAnnouncement(text);
  }

  async function onSubmit(values: FormValues) {
    setAnnouncement("");
    try {
      await login(values.email, values.password);
      navigate(from, { replace: true });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const message = err instanceof ApiError ? err.message.toLowerCase() : "";

      if (status === 429) {
        fail("limited", values, "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.");
        return;
      }
      if (message.includes("desactivad")) {
        fail("deactivated", values, "La cuenta está desactivada. Solicita la reactivación a tu administrador.");
        return;
      }
      if (status !== 401) {
        fail("failed", values, "No se pudo iniciar sesión. Revisa tu conexión y vuelve a intentarlo.");
        return;
      }

      const next = attempt + 1;
      setAttempt(next);
      fail(
        "mismatch",
        values,
        next === 1
          ? "Correo y contraseña no coinciden. Por favor verifica tus credenciales."
          : "Sigue sin coincidir. Puedes recuperar la contraseña desde el enlace.",
      );
      setSettle(true);
      setRelayKey((k) => k + 1);
    }
  }

  function recharge() {
    if (phase === "idle" || !stale) return;
    const { email, password } = getValues();
    if (email === stale.email && password === stale.password) return;
    setPhase("idle");
    setAnnouncement("");
  }

  function handleEmailBlur(e: React.FocusEvent<HTMLInputElement>) {
    emailReg.onBlur(e);
    const val = e.target.value.trim();
    if (!val) {
      setEmailBlurError("Ingresa tu correo");
      return;
    }
    const result = z.string().email().safeParse(val);
    if (!result.success) {
      setEmailBlurError("Correo inválido");
      return;
    }
    setEmailBlurError(null);
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    emailReg.onChange(e);
    const val = e.target.value.trim();

    // Si ya teníamos el mensaje de correo inválido activo:
    if (emailBlurError) {
      const result = z.string().email().safeParse(val);
      if (result.success) {
        // En cuanto lo que escribe sea un correo válido, se quita el error y vuelve a 'Iniciar sesión'
        setEmailBlurError(null);
      } else {
        // Si aún no es válido, se mantiene el mensaje correspondiente
        setEmailBlurError(val ? "Correo inválido" : "Ingresa tu correo");
      }
    }
    recharge();
  }

  const emailReg = register("email");
  const passwordReg = register("password");
  const staleEmail = stale?.email ?? "";

  let buttonTone: "primary" | "ink" = "primary";
  let buttonToneLabel: React.ReactNode = undefined;
  let isButtonDisabled = false;

  if (emailBlurError) {
    buttonTone = "ink";
    buttonToneLabel = emailBlurError;
    isButtonDisabled = true;
  } else if (phase !== "idle") {
    buttonTone = "ink";
    buttonToneLabel = toneLabels[phase];
    isButtonDisabled = false;
  }

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Panel interno de operaciones"
      settle={settle}
      footer={
        <div className="space-y-4">
          <div className="flex items-center justify-between text-[12px] text-zinc-500">
            <span className="flex items-center gap-1.5 font-medium text-zinc-600">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Acceso seguro SSL
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Uso interno
            </span>
          </div>
          <p className="text-center text-[12.5px] leading-relaxed text-zinc-500">
            ¿Aún no tienes acceso?{" "}
            <span className="font-semibold text-zinc-800">Solicítalo a tu administrador.</span>
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5 sm:gap-5.5">
        {phase === "limited" && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/90 bg-amber-50/80 p-3.5 text-[13px] text-amber-900 animate-plf-rise">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <div className="flex-1 leading-snug">
              <span>Demasiados intentos de acceso.</span> Por seguridad, espera unos minutos o{" "}
              <Link
                to="/forgot-password"
                state={{ email: staleEmail }}
                className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800"
              >
                recupera tu contraseña
              </Link>.
            </div>
          </div>
        )}

        {phase === "deactivated" && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200/90 bg-red-50/80 p-3.5 text-[13px] text-red-900 animate-plf-rise">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" aria-hidden />
            <div className="flex-1 leading-snug">
              Esta cuenta ha sido desactivada. Solicita su reactivación al administrador de sistemas.
            </div>
          </div>
        )}

        {phase === "failed" && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200/90 bg-red-50/80 p-3.5 text-[13px] text-red-900 animate-plf-rise">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" aria-hidden />
            <div className="flex-1 leading-snug">
              No se pudo conectar con el servidor. Revisa tu conexión a la red e inténtalo de nuevo.
            </div>
          </div>
        )}

        <AuthField
          label="Correo corporativo"
          placeholder="nombre@plastifar.com"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoFocus
          icon={<Mail className="h-[18px] w-[18px]" />}
          hasError={Boolean(emailBlurError)}
          {...emailReg}
          onChange={handleEmailChange}
          onBlur={handleEmailBlur}
        />

        <AuthPasswordField
          label="Contraseña"
          placeholder="••••••••"
          autoComplete="current-password"
          icon={<Lock className="h-[18px] w-[18px]" />}
          error={errors.password?.message}
          relayFrom={buttonRef}
          relayKey={relayKey}
          action={
            <Link
              to="/forgot-password"
              state={{ email: staleEmail || getValues("email") }}
              className="text-[12.5px] font-medium text-zinc-500 transition-colors hover:text-brand-red hover:underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-red rounded"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          }
          {...passwordReg}
          onChange={(e) => {
            passwordReg.onChange(e);
            recharge();
          }}
        />

        <AuthButton
          ref={buttonRef}
          type="submit"
          disabled={isButtonDisabled}
          isLoading={isSubmitting}
          tone={buttonTone}
          toneLabel={buttonToneLabel}
          className="mt-2.5 sm:mt-3"
        >
          {isSubmitting ? "Iniciando sesión…" : "Iniciar sesión"}
        </AuthButton>

        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </form>
    </AuthLayout>
  );
}
