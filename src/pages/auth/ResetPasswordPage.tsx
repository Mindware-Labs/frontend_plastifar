import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Lock, LockKeyhole, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { AuthAlert } from "../../components/auth/AuthAlert";
import { AuthButton, type AuthButtonTone } from "../../components/auth/AuthButton";
import { AuthField, AuthPasswordField } from "../../components/auth/AuthField";
import { AuthToast } from "../../components/auth/AuthToast";
import { PasswordStrength } from "../../components/ui/PasswordStrength";
import { evaluatePassword, passwordSchema } from "../../lib/password";
import { OtpCodeInput } from "../../components/auth/OtpCodeInput";
import { AuthLayout } from "../../layouts/AuthLayout";

const codeSchema = z.object({
  email: z.string().min(1, "Ingresa tu correo").email("Correo inválido"),
  code: z.string().regex(/^\d{6}$/, "El código son 6 dígitos"),
});
type CodeFormValues = z.infer<typeof codeSchema>;

// Las reglas viven en lib/password.ts, junto al medidor de fuerza y a la
// politica del servidor: un solo sitio donde cambiarlas.
const passwordFormSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

type Step = "code" | "password" | "done";
/** idle: listo para verificar. El resto describe por qué no prosperó el último envío. */
type CodePhase = "idle" | "verified" | "wrong" | "limited" | "failed";

const codeToneLabels: Record<Exclude<CodePhase, "idle">, string> = {
  verified: "Código verificado",
  wrong: "Código incorrecto",
  limited: "Demasiados intentos",
  failed: "No se pudo verificar",
};

/** idle: listo para guardar. El resto describe por qué no prosperó el último envío. */
type PasswordPhase = "idle" | "expired" | "limited" | "failed";

const passwordToneLabels: Record<Exclude<PasswordPhase, "idle">, string> = {
  expired: "Código vencido",
  limited: "Demasiados intentos",
  failed: "No se pudo actualizar",
};

const SETTLE_MS = 340;
// Seis dígitos en cascada de 60 ms más la última confirmación de 420 ms.
const CONFIRM_HOLD_MS = 760;
type ToastState = { message: string; variant: "error" | "success" };

const RESEND_COOLDOWN_SECONDS = 120;

const backLinkClass =
  "inline-flex items-center gap-1.5 rounded text-[13.5px] font-medium text-brand-gray transition-colors hover:text-brand-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<Step>("code");
  const [toast, setToast] = useState<ToastState | null>(null);
  // Solo se llena tras una verificación exitosa del código: es lo que habilita el paso 2.
  const [verified, setVerified] = useState<{ email: string; code: string } | null>(null);
  // Arranca en 2 minutos: ya se envió un código al llegar a esta pantalla desde ForgotPasswordPage.
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const [codePhase, setCodePhase] = useState<CodePhase>("idle");
  const [codeAttempt, setCodeAttempt] = useState(0);
  // Valores del último envío fallido: mientras no cambien, el botón sigue en tinta.
  const [staleCode, setStaleCode] = useState<CodeFormValues | null>(null);
  const [settle, setSettle] = useState(false);
  const [relayKey, setRelayKey] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const verifyButtonRef = useRef<HTMLButtonElement>(null);
  const [passwordPhase, setPasswordPhase] = useState<PasswordPhase>("idle");
  const [stalePassword, setStalePassword] = useState<PasswordFormValues | null>(null);

  useEffect(() => {
    if (!settle) return;
    const timer = window.setTimeout(() => setSettle(false), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [settle]);

  const searchParams = new URLSearchParams(location.search);
  const queryEmail = (searchParams.get("email") ?? "").trim();
  const queryCode = (searchParams.get("code") ?? "").trim();
  const isInvite = searchParams.get("mode") === "invite" || searchParams.get("type") === "invite";

  const prefillEmail = ((location.state as { email?: string } | null)?.email || queryEmail).trim();

  const codeForm = useForm<CodeFormValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: {
      email: prefillEmail,
      code: /^\d{6}$/.test(queryCode) ? queryCode : "",
    },
  });

  useEffect(() => {
    if (prefillEmail) {
      codeForm.setValue("email", prefillEmail);
    }
    if (/^\d{6}$/.test(queryCode)) {
      codeForm.setValue("code", queryCode);
    }
  }, [prefillEmail, queryCode, codeForm]);

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const newPassword = useWatch({ control: passwordForm.control, name: "newPassword" }) ?? "";
  const confirmPassword = useWatch({ control: passwordForm.control, name: "confirmPassword" }) ?? "";
  const strength = evaluatePassword(newPassword);
  const missingRules = strength.rules.length - strength.score;
  const passwordsMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  useEffect(() => {
    if (step !== "code" || resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, resendCooldown]);

  async function handleResendCode() {
    const email = codeForm.getValues("email");
    if (!email) {
      setToast({ message: "Ingresa tu correo para reenviar el código", variant: "error" });
      return;
    }

    setToast(null);
    setIsResending(true);
    try {
      await authApi.forgotPassword({ email });
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setToast({ message: `Reenviamos el código a ${email}`, variant: "success" });
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : "No se pudo reenviar el código",
        variant: "error",
      });
    } finally {
      setIsResending(false);
    }
  }

  async function onSubmitCode(values: CodeFormValues) {
    setToast(null);
    setAnnouncement("");
    try {
      await authApi.verifyResetCode(values);
      setCodePhase("verified");
      setAnnouncement("Código verificado. Ahora crea tu nueva contraseña.");
      await new Promise((resolve) => setTimeout(resolve, CONFIRM_HOLD_MS));
      setVerified(values);
      setStep("password");
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setStaleCode(values);
      if (status === 429) {
        setCodePhase("limited");
        setAnnouncement("Demasiados intentos. Espera unos minutos antes de volver a intentarlo.");
        return;
      }
      if (status !== 400) {
        setCodePhase("failed");
        setAnnouncement("No se pudo verificar el código. Revisa tu conexión y vuelve a intentarlo.");
        return;
      }
      // El servidor no distingue incorrecto, vencido o bloqueado: la salida es siempre reenviar.
      const next = codeAttempt + 1;
      setCodeAttempt(next);
      setCodePhase("wrong");
      setAnnouncement(
        next === 1
          ? "Código incorrecto. Estás en el primer dígito."
          : "Sigue incorrecto. Puedes pedir un código nuevo.",
      );
      setSettle(true);
      setRelayKey((k) => k + 1);
    }
  }

  /** Al primer cambio respecto al envío fallido el botón recupera el rojo. */
  function rechargeCode() {
    if (codePhase === "idle" || codePhase === "verified" || !staleCode) return;
    const { email, code } = codeForm.getValues();
    if (email === staleCode.email && code === staleCode.code) return;
    setCodePhase("idle");
    setAnnouncement("");
  }

  async function onSubmitPassword(values: PasswordFormValues) {
    if (!verified) return;

    setAnnouncement("");
    try {
      await authApi.resetPassword({ ...verified, newPassword: values.newPassword });
      setStep("done");
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const code = err instanceof ApiError ? err.code : undefined;
      setStalePassword(values);
      setSettle(true);
      if (status === 429) {
        setPasswordPhase("limited");
        setAnnouncement("Demasiados intentos. Espera unos minutos antes de volver a intentarlo.");
        return;
      }
      if (status === 400 && code !== "weak_password") {
        setPasswordPhase("expired");
        setAnnouncement("El código ya no es válido. Vuelve a ingresar el código o pide uno nuevo.");
        return;
      }
      setPasswordPhase("failed");
      setAnnouncement("No se pudo actualizar la contraseña. Revisa tu conexión y vuelve a intentarlo.");
    }
  }

  /** Al primer cambio respecto al envío fallido el botón recupera el rojo. */
  function rechargePassword() {
    if (passwordPhase === "idle" || !stalePassword) return;
    const current = passwordForm.getValues();
    if (
      current.newPassword === stalePassword.newPassword &&
      current.confirmPassword === stalePassword.confirmPassword
    ) {
      return;
    }
    setPasswordPhase("idle");
    setAnnouncement("");
  }

  // El botón dice lo que falta en vez de deshabilitarse: es el indicador de que aún no se puede guardar.
  let passwordTone: AuthButtonTone = "primary";
  let passwordToneLabel: string | undefined;
  if (passwordPhase !== "idle") {
    passwordTone = "ink";
    passwordToneLabel = passwordToneLabels[passwordPhase];
  } else if (newPassword && missingRules > 0) {
    passwordTone = "ink";
    passwordToneLabel = missingRules === 1 ? "Falta 1 requisito" : `Faltan ${missingRules} requisitos`;
  } else if (passwordsMismatch) {
    passwordTone = "ink";
    passwordToneLabel = "No coinciden";
  }

  if (step === "done") {
    return (
      <AuthLayout title={isInvite ? "Cuenta activada" : "Contraseña actualizada"}>
        <AuthAlert variant="success">
          {isInvite
            ? "Tu contraseña se configuró correctamente. Ya puedes iniciar sesión en el panel."
            : "Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión."}
        </AuthAlert>
        <AuthButton className="mt-6" onClick={() => navigate("/login", { replace: true })}>
          Ir a iniciar sesión
        </AuthButton>
      </AuthLayout>
    );
  }

  if (step === "password") {
    return (
      <AuthLayout
        settle={settle}
        title={isInvite ? "Crear contraseña" : "Nueva contraseña"}
        subtitle={
          isInvite
            ? `Configura tu contraseña de acceso para ${verified?.email}`
            : `Código verificado para ${verified?.email}`
        }
      >
        <form
          onSubmit={passwordForm.handleSubmit(onSubmitPassword)}
          noValidate
          className="flex flex-col gap-5"
        >
          <AuthPasswordField
            label={isInvite ? "Contraseña" : "Nueva contraseña"}
            autoComplete="new-password"
            autoFocus
            icon={<Lock className="h-[18px] w-[18px]" />}
            error={passwordForm.formState.errors.newPassword?.message}
            {...passwordForm.register("newPassword")}
            onChange={(e) => {
              passwordForm.register("newPassword").onChange(e);
              rechargePassword();
            }}
          />
          <AuthPasswordField
            label="Confirmar contraseña"
            autoComplete="new-password"
            icon={<LockKeyhole className="h-[18px] w-[18px]" />}
            error={passwordForm.formState.errors.confirmPassword?.message}
            notice={passwordsMismatch ? "No coinciden" : undefined}
            {...passwordForm.register("confirmPassword")}
            onChange={(e) => {
              passwordForm.register("confirmPassword").onChange(e);
              rechargePassword();
            }}
          />

          <PasswordStrength value={newPassword} className="-mt-1" />

          <AuthButton
            type="submit"
            isLoading={passwordForm.formState.isSubmitting}
            tone={passwordTone}
            toneLabel={passwordToneLabel}
            className="mt-1"
          >
            {passwordForm.formState.isSubmitting
              ? isInvite
                ? "Activando cuenta…"
                : "Actualizando…"
              : isInvite
                ? "Activar cuenta"
                : "Actualizar contraseña"}
          </AuthButton>

          <p role="status" aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </form>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setToast(null);
              setCodePhase("idle");
              setPasswordPhase("idle");
              setStep("code");
            }}
            className={backLinkClass}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Volver a ingresar el código
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      settle={settle}
      title={isInvite ? "Activar cuenta" : "Restablecer contraseña"}
      subtitle={
        prefillEmail
          ? isInvite
            ? `Ingresa el código de 6 dígitos enviado a ${prefillEmail}`
            : `Enviamos un código de 6 dígitos a ${prefillEmail}`
          : isInvite
            ? "Ingresa el código de 6 dígitos que recibiste en tu correo de invitación"
            : "Ingresa el código de 6 dígitos que recibiste por correo"
      }
    >
      <AuthToast
        message={toast?.message ?? null}
        variant={toast?.variant}
        onDismiss={() => setToast(null)}
      />

      <form
        onSubmit={codeForm.handleSubmit(onSubmitCode)}
        noValidate
        className="-mt-3.5 flex flex-col gap-5"
      >
        {prefillEmail ? (
          <input type="hidden" {...codeForm.register("email")} />
        ) : (
          <AuthField
            label="Correo corporativo"
            placeholder="nombre@plastifar.com"
            type="email"
            inputMode="email"
            autoComplete="username"
            icon={<Mail className="h-[18px] w-[18px]" />}
            error={codeForm.formState.errors.email?.message}
            {...codeForm.register("email")}
            onChange={(e) => {
              codeForm.register("email").onChange(e);
              rechargeCode();
            }}
          />
        )}

        <div>
          <p className="mb-2.5 text-center text-[15px] font-semibold uppercase tracking-[0.08em] text-ink">
            Código
          </p>
          <Controller
            control={codeForm.control}
            name="code"
            render={({ field, fieldState }) => (
              <OtpCodeInput
                value={field.value ?? ""}
                onChange={(value) => {
                  field.onChange(value);
                  rechargeCode();
                }}
                error={fieldState.error?.message}
                invalid={codePhase === "wrong"}
                success={codePhase === "verified"}
                relayFrom={verifyButtonRef}
                relayKey={relayKey}
                autoFocus
              />
            )}
          />

          <p className="mt-3 text-center text-[13px] text-zinc-500">
            {codePhase === "wrong" && (
              <span className="font-semibold text-ink">
                {codeAttempt === 1 ? "Puede estar vencido" : "Sigue incorrecto"} ·{" "}
              </span>
            )}
            {resendCooldown > 0 ? (
              <>
                Reenviar código en{" "}
                <span className="font-medium tabular-nums text-brand-gray">
                  {String(Math.floor(resendCooldown / 60)).padStart(2, "0")}:
                  {String(resendCooldown % 60).padStart(2, "0")}
                </span>
              </>
            ) : (
              <>
                {codePhase !== "wrong" && "¿No recibiste el código? "}
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isResending}
                  className="rounded font-medium text-brand-red underline-offset-4 transition-colors hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResending ? "Reenviando…" : "Reenviar código"}
                </button>
              </>
            )}
          </p>
        </div>

        <AuthButton
          ref={verifyButtonRef}
          type="submit"
          isLoading={codeForm.formState.isSubmitting}
          tone={codePhase === "idle" ? "primary" : codePhase === "verified" ? "success" : "ink"}
          toneLabel={codePhase === "idle" ? undefined : codeToneLabels[codePhase]}
          className="mt-1"
        >
          {codeForm.formState.isSubmitting
            ? "Verificando…"
            : isInvite
              ? "Verificar código y continuar"
              : "Verificar código"}
        </AuthButton>

        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </form>

      <div className="mt-8 flex justify-center">
        <Link to="/login" className={backLinkClass}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a iniciar sesión
        </Link>
      </div>
    </AuthLayout>
  );
}
