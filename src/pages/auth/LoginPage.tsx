import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PasswordField, TextField, type FieldState } from "../../components/ui/Field";
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
  const [announcement, setAnnouncement] = useState("");
  const [stale, setStale] = useState<FormValues | null>(null);
  const [emailBlurError, setEmailBlurError] = useState<string | null>(null);

  useEffect(() => {
    if (!settle) return;
    const timer = window.setTimeout(() => setSettle(false), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [settle]);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched" });

  const requested = (location.state as { from?: string } | null)?.from;
  const from = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";

  function stateOf(field: keyof FormValues): FieldState {
    if (field === "email" && emailBlurError) return "error";
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

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
      if (emailBlurError !== "Ingresa tu correo") {
        setEmailBlurError("Ingresa tu correo");
        setSettle(true);
      }
      return;
    }
    const result = z.string().email().safeParse(val);
    if (!result.success) {
      if (emailBlurError !== "Correo inválido") {
        setEmailBlurError("Correo inválido");
        setSettle(true);
      }
      return;
    }
    setEmailBlurError(null);
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    emailReg.onChange(e);
    const val = e.target.value.trim();

    if (emailBlurError) {
      const result = z.string().email().safeParse(val);
      if (result.success) {
        setEmailBlurError(null);
      } else {
        setEmailBlurError(val ? "Correo inválido" : "Ingresa tu correo");
      }
    }
    recharge();
  }

  const emailReg = register("email");
  const passwordReg = register("password");
  const staleEmail = stale?.email ?? "";

  let buttonTone: "primary" | "ink" = "primary";
  let buttonToneLabel: string | undefined;
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
          <div className="flex items-center justify-between text-[12px] text-subtle">
            <span className="flex items-center gap-1.5 font-medium text-ink">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Acceso seguro SSL
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-0.5 text-[11px] font-medium text-subtle">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Uso interno
            </span>
          </div>
          <p className="text-center text-[12.5px] leading-relaxed text-subtle">
            ¿Aún no tienes acceso?{" "}
            <span className="font-semibold text-ink">Solicítalo a tu administrador.</span>
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3.5">
        {phase === "limited" && (
          <Alert variant="info" className="text-[13px]">
            <span className="font-medium">Demasiados intentos de acceso.</span> Por seguridad, espera unos minutos o{" "}
            <Link
              to="/forgot-password"
              state={{ email: staleEmail }}
              className="font-medium text-brand-red-dark underline underline-offset-2"
            >
              recupera tu contraseña
            </Link>
            .
          </Alert>
        )}

        {phase === "deactivated" && (
          <Alert variant="error">
            Esta cuenta ha sido desactivada. Solicita su reactivación al administrador de sistemas.
          </Alert>
        )}

        {phase === "failed" && (
          <Alert variant="error">
            No se pudo conectar con el servidor. Revisa tu conexión a la red e inténtalo de nuevo.
          </Alert>
        )}

        <TextField
          size="sm"
          label="Correo corporativo"
          placeholder="nombre@plastifar.com"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoFocus
          required
          state={stateOf("email")}
          error={emailBlurError ?? errors.email?.message}
          {...emailReg}
          onChange={handleEmailChange}
          onBlur={handleEmailBlur}
        />

        <PasswordField
          label="Contraseña"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          state={stateOf("password")}
          error={errors.password?.message}
          hint={
            <span className="flex justify-end">
              <Link
                to="/forgot-password"
                state={{ email: staleEmail || getValues("email") }}
                className="font-medium text-brand-red-dark hover:underline underline-offset-2"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </span>
          }
          {...passwordReg}
          onChange={(e) => {
            passwordReg.onChange(e);
            recharge();
          }}
        />

        <Button
          type="submit"
          disabled={isButtonDisabled}
          isLoading={isSubmitting}
          tone={buttonTone}
          toneLabel={buttonToneLabel}
          className="mt-1 w-full"
        >
          {isSubmitting ? "Iniciando sesión…" : "Iniciar sesión"}
        </Button>

        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </form>
    </AuthLayout>
  );
}
