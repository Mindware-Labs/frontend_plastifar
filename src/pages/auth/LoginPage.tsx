import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Lock, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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

/** idle: listo para enviar. El resto describe por qué no prosperó el último envío. */
type Phase = "idle" | "mismatch" | "deactivated" | "limited" | "failed";

const toneLabels: Record<Exclude<Phase, "idle">, string> = {
  mismatch: "No coinciden",
  deactivated: "Cuenta desactivada",
  limited: "Demasiados intentos",
  failed: "No se pudo entrar",
};

const SETTLE_MS = 340;
const RAMP_AFTER_ATTEMPTS = 3;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [attempt, setAttempt] = useState(0);
  const [settle, setSettle] = useState(false);
  const [relayKey, setRelayKey] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  // Valores del último envío fallido: mientras no cambien, el botón sigue en tinta.
  const [stale, setStale] = useState<FormValues | null>(null);
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

  // Solo rutas internas: "//otro.sitio" o una URL absoluta harian de la pantalla de acceso un redirector abierto.
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
          ? "Correo y contraseña no coinciden. Estás en el campo Contraseña."
          : "Sigue sin coincidir. Puedes recuperar la contraseña desde el enlace.",
      );
      setSettle(true);
      setRelayKey((k) => k + 1);
    }
  }

  /** Al primer cambio respecto al envío fallido el botón recupera el rojo. */
  function recharge() {
    if (phase === "idle" || !stale) return;
    const { email, password } = getValues();
    if (email === stale.email && password === stale.password) return;
    setPhase("idle");
    setAnnouncement("");
  }

  const emailReg = register("email");
  const passwordReg = register("password");
  const staleEmail = stale?.email ?? "";

  function recoverLink(label: string) {
    return (
      <Link
        to="/forgot-password"
        state={{ email: staleEmail }}
        className="ml-1 font-semibold text-brand-red hover:underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-red rounded"
      >
        {label}
      </Link>
    );
  }

  let passwordNotice: ReactNode;
  if (phase === "mismatch") {
    passwordNotice =
      attempt === 1 ? (
        <>No coinciden ·{recoverLink("¿La olvidaste?")}</>
      ) : (
        <>Sigue sin coincidir ·{recoverLink("Recuperar")}</>
      );
  } else if (phase === "limited") {
    passwordNotice = <>Por seguridad ·{recoverLink("Recuperar")}</>;
  } else if (phase === "failed") {
    passwordNotice = "Revisa tu conexión";
  }

  const emailNotice = phase === "deactivated" ? "Habla con tu administrador" : undefined;

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Panel interno de operaciones"
      settle={settle}
      footer={
        <div className="space-y-4">
          <div className="flex items-center justify-between text-[11.5px] text-zinc-500">
            <span className="flex items-center gap-1.5 font-medium text-zinc-600">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Acceso seguro
            </span>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
              Uso interno
            </span>
          </div>
          <p className="text-center text-[12px] leading-relaxed text-zinc-500">
            ¿Aún no tienes acceso?{" "}
            <span className="font-semibold text-zinc-800">Solicítalo a tu administrador.</span>
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4.5">
        <AuthField
          label="Correo corporativo"
          placeholder="nombre@plastifar.com"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoFocus
          icon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          notice={emailNotice}
          {...emailReg}
          onChange={(e) => {
            emailReg.onChange(e);
            recharge();
          }}
        />

        <AuthPasswordField
          label="Contraseña"
          placeholder="••••••••"
          autoComplete="current-password"
          icon={<Lock className="h-4 w-4" />}
          error={errors.password?.message}
          notice={passwordNotice}
          relayFrom={buttonRef}
          relayKey={relayKey}
          action={
            <Link
              to="/forgot-password"
              className="text-[12px] font-medium text-zinc-500 transition-colors hover:text-brand-red hover:underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-red rounded"
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
          isLoading={isSubmitting}
          tone={phase === "idle" ? "primary" : "ink"}
          toneLabel={phase === "idle" ? undefined : toneLabels[phase]}
          className="mt-2"
        >
          {isSubmitting ? "Iniciando sesión…" : "Entrar al panel"}
        </AuthButton>

        {/* Rampa de salida: el único elemento que se añade, y solo tras varios intentos. */}
        {attempt >= RAMP_AFTER_ATTEMPTS && (
          <Link
            to="/forgot-password"
            state={{ email: staleEmail }}
            className="animate-plf-rise flex h-[38px] items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white text-[12.5px] font-medium text-zinc-900 transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
          >
            <KeyRound className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
            Recuperar contraseña
            <span className="truncate font-normal text-zinc-500">· {staleEmail}</span>
          </Link>
        )}

        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </form>
    </AuthLayout>
  );
}
