import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Lock, LockKeyhole, Mail } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { AuthAlert } from "../../components/auth/AuthAlert";
import { AuthButton } from "../../components/auth/AuthButton";
import { AuthField, AuthPasswordField } from "../../components/auth/AuthField";
import { AuthToast } from "../../components/auth/AuthToast";
import { PasswordStrength } from "../../components/ui/PasswordStrength";
import { PASSWORD_MAX_LENGTH, evaluatePassword, passwordSchema } from "../../lib/password";
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
type ToastState = { message: string; variant: "error" | "success" };

const RESEND_COOLDOWN_SECONDS = 120;

const backLinkClass =
  "inline-flex items-center gap-1.5 rounded text-[13.5px] font-medium text-brand-gray transition-colors hover:text-brand-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red";

/** Lo que se anuncia al cambiar de paso; el titulo visible no basta porque el
 *  cuerpo entero se reemplaza sin que nada mueva el punto de lectura. */
const STEP_ANNOUNCEMENT: Record<Step, string> = {
  code: "Paso 1 de 2: ingresa el código de 6 dígitos que recibiste por correo.",
  password: "Código verificado. Paso 2 de 2: crea tu nueva contraseña.",
  done: "Contraseña actualizada correctamente. Ya puedes iniciar sesión.",
};

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { email?: string; notice?: string } | null;
  const prefillEmail = navState?.email ?? "";

  const [step, setStep] = useState<Step>("code");
  // La confirmacion del envio que trae ForgotPasswordPage es el valor inicial
  // del aviso, no un efecto: al llegar aqui ya ocurrio, y montarla en un efecto
  // solo añadiria un render extra. Sin ella se aterrizaba en esta pantalla sin
  // ninguna señal de que el correo habia salido.
  const [toast, setToast] = useState<ToastState | null>(
    navState?.notice ? { message: navState.notice, variant: "success" } : null,
  );
  // Solo se llena tras una verificación exitosa del código: es lo que habilita el paso 2.
  const [verified, setVerified] = useState<{ email: string; code: string } | null>(null);
  // Arranca en 2 minutos: ya se envió un código al llegar a esta pantalla desde ForgotPasswordPage.
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);

  const codeHeadingId = useId();
  const doneRef = useRef<HTMLDivElement>(null);

  const codeForm = useForm<CodeFormValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { email: prefillEmail },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const newPassword = useWatch({ control: passwordForm.control, name: "newPassword" }) ?? "";

  useEffect(() => {
    if (step !== "code" || resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, resendCooldown]);

  // Los pasos 1 y 2 llevan el foco a su primer campo con autoFocus al montarse.
  // El paso final no tiene campo, asi que se enfoca su bloque: sin esto el
  // punto de lectura se quedaba en un boton que ya no existe.
  useEffect(() => {
    if (step === "done") doneRef.current?.focus();
  }, [step]);

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
      // El código anterior queda invalidado por el reenvío: dejar sus seis
      // dígitos en pantalla invita a enviarlos otra vez y fallar.
      codeForm.setValue("code", "");
      codeForm.clearErrors("code");
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
    try {
      await authApi.verifyResetCode(values);
      setVerified(values);
      setStep("password");
    } catch (err) {
      // Código incorrecto o expirado: no avanza, se queda en este paso con el error visible.
      setToast({
        message: err instanceof ApiError ? err.message : "Código inválido o expirado",
        variant: "error",
      });
    }
  }

  async function onSubmitPassword(values: PasswordFormValues) {
    if (!verified) return;

    setToast(null);
    try {
      await authApi.resetPassword({ ...verified, newPassword: values.newPassword });
      setStep("done");
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : "No se pudo actualizar la contraseña",
        variant: "error",
      });
    }
  }

  const titles: Record<Step, { title: string; subtitle?: string }> = {
    code: {
      title: "Restablecer contraseña",
      subtitle: prefillEmail
        ? `Enviamos un código de 6 dígitos a ${prefillEmail}`
        : "Ingresa el código de 6 dígitos que recibiste por correo",
    },
    password: {
      title: "Nueva contraseña",
      subtitle: `Código verificado para ${verified?.email}`,
    },
    done: { title: "Contraseña actualizada" },
  };

  // Un solo AuthLayout para los tres pasos: asi la region de anuncio y el
  // montaje del toast sobreviven al cambio de paso. Con un return por paso, el
  // aviso pendiente desaparecia sin decir nada y el mensaje de exito se montaba
  // junto al resto del arbol, que es justo cuando un lector de pantalla no lo lee.
  return (
    <AuthLayout title={titles[step].title} subtitle={titles[step].subtitle}>
      <p aria-live="polite" className="sr-only">
        {STEP_ANNOUNCEMENT[step]}
      </p>

      <AuthToast
        message={toast?.message ?? null}
        variant={toast?.variant}
        onDismiss={() => setToast(null)}
      />

      {step === "done" && (
        <div ref={doneRef} tabIndex={-1} className="outline-none">
          <AuthAlert variant="success">
            Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.
          </AuthAlert>
          <AuthButton className="mt-6" onClick={() => navigate("/login", { replace: true })}>
            Ir a iniciar sesión
          </AuthButton>
        </div>
      )}

      {step === "password" && (
        <>
          <form
            onSubmit={passwordForm.handleSubmit(onSubmitPassword)}
            noValidate
            className="flex flex-col gap-5"
          >
            <AuthPasswordField
              label="Nueva contraseña"
              autoComplete="new-password"
              autoFocus
              // El limite se valida en el esquema; ponerlo tambien en el control
              // evita escribir de mas y enterarse solo al enviar.
              maxLength={PASSWORD_MAX_LENGTH}
              icon={<Lock className="h-[18px] w-[18px]" />}
              error={passwordForm.formState.errors.newPassword?.message}
              {...passwordForm.register("newPassword")}
            />
            <AuthPasswordField
              label="Confirmar contraseña"
              autoComplete="new-password"
              maxLength={PASSWORD_MAX_LENGTH}
              icon={<LockKeyhole className="h-[18px] w-[18px]" />}
              error={passwordForm.formState.errors.confirmPassword?.message}
              {...passwordForm.register("confirmPassword")}
            />

            <PasswordStrength value={newPassword} className="-mt-1" />

            <AuthButton
              type="submit"
              isLoading={passwordForm.formState.isSubmitting}
              disabled={!evaluatePassword(newPassword).isValid}
              className="mt-1"
            >
              {passwordForm.formState.isSubmitting ? "Actualizando…" : "Actualizar contraseña"}
            </AuthButton>
          </form>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setToast(null);
                setStep("code");
              }}
              className={backLinkClass}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Volver a ingresar el código
            </button>
          </div>
        </>
      )}

      {step === "code" && (
        <>
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
              />
            )}

            <div>
              {/* Encabezado real, no un parrafo con aspecto de encabezado: es lo
                  que nombra al grupo de las seis casillas. */}
              <h2
                id={codeHeadingId}
                // Etiqueta de un grupo de campos: va en el paso de etiqueta de
                // la rampa (10.5px), como cualquier otra del panel.
                className="mb-2.5 text-center font-heading text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint"
              >
                Código
              </h2>
              <Controller
                control={codeForm.control}
                name="code"
                render={({ field, fieldState }) => (
                  <OtpCodeInput
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    labelledBy={codeHeadingId}
                    autoFocus
                  />
                )}
              />

              <p className="mt-3 text-center text-[13px] text-muted">
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
                    ¿No recibiste el código?{" "}
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

            <AuthButton type="submit" isLoading={codeForm.formState.isSubmitting} className="mt-1">
              {codeForm.formState.isSubmitting ? "Verificando…" : "Verificar código"}
            </AuthButton>
          </form>

          <div className="mt-8 flex justify-center">
            <Link to="/login" className={backLinkClass}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Volver a iniciar sesión
            </Link>
          </div>
        </>
      )}
    </AuthLayout>
  );
}
