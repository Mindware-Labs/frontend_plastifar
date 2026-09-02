import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Lock, LockKeyhole, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { AuthAlert } from "../../components/auth/AuthAlert";
import { AuthButton } from "../../components/auth/AuthButton";
import { AuthField, AuthPasswordField } from "../../components/auth/AuthField";
import { OtpCodeInput } from "../../components/auth/OtpCodeInput";
import { AuthLayout } from "../../layouts/AuthLayout";

const codeSchema = z.object({
  email: z.string().min(1, "Ingresa tu correo").email("Correo inválido"),
  code: z.string().regex(/^\d{6}$/, "El código son 6 dígitos"),
});
type CodeFormValues = z.infer<typeof codeSchema>;

const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[a-zA-Z]/, "Debe incluir al menos una letra")
      .regex(/[0-9]/, "Debe incluir al menos un número"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });
type PasswordFormValues = z.infer<typeof passwordSchema>;

type Step = "code" | "password" | "done";

const RESEND_COOLDOWN_SECONDS = 120;

const backLinkClass =
  "inline-flex items-center gap-1.5 rounded text-[13.5px] font-medium text-brand-gray transition-colors hover:text-brand-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<Step>("code");
  const [formError, setFormError] = useState<string | null>(null);
  // Solo se llena tras una verificación exitosa del código: es lo que habilita el paso 2.
  const [verified, setVerified] = useState<{ email: string; code: string } | null>(null);
  // Arranca en 2 minutos: ya se envió un código al llegar a esta pantalla desde ForgotPasswordPage.
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);

  const prefillEmail = (location.state as { email?: string } | null)?.email ?? "";

  const codeForm = useForm<CodeFormValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { email: prefillEmail },
  });

  const passwordForm = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    if (step !== "code" || resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, resendCooldown]);

  async function handleResendCode() {
    const email = codeForm.getValues("email");
    if (!email) {
      setFormError("Ingresa tu correo para reenviar el código");
      return;
    }

    setFormError(null);
    setIsResending(true);
    try {
      await authApi.forgotPassword({ email });
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo reenviar el código");
    } finally {
      setIsResending(false);
    }
  }

  async function onSubmitCode(values: CodeFormValues) {
    setFormError(null);
    try {
      await authApi.verifyResetCode(values);
      setVerified(values);
      setStep("password");
    } catch (err) {
      // Código incorrecto o expirado: no avanza, se queda en este paso con el error visible.
      setFormError(err instanceof ApiError ? err.message : "Código inválido o expirado");
    }
  }

  async function onSubmitPassword(values: PasswordFormValues) {
    if (!verified) return;

    setFormError(null);
    try {
      await authApi.resetPassword({ ...verified, newPassword: values.newPassword });
      setStep("done");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo actualizar la contraseña");
    }
  }

  if (step === "done") {
    return (
      <AuthLayout title="Contraseña actualizada">
        <AuthAlert variant="success">
          Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.
        </AuthAlert>
        <AuthButton className="mt-6" onClick={() => navigate("/login", { replace: true })}>
          Ir a iniciar sesión
        </AuthButton>
      </AuthLayout>
    );
  }

  if (step === "password") {
    return (
      <AuthLayout title="Nueva contraseña" subtitle={`Código verificado para ${verified?.email}`}>
        <form
          onSubmit={passwordForm.handleSubmit(onSubmitPassword)}
          noValidate
          className="flex flex-col gap-5"
        >
          {formError && <AuthAlert>{formError}</AuthAlert>}

          <AuthPasswordField
            label="Nueva contraseña"
            autoComplete="new-password"
            autoFocus
            icon={<Lock className="h-[18px] w-[18px]" />}
            error={passwordForm.formState.errors.newPassword?.message}
            {...passwordForm.register("newPassword")}
          />
          <AuthPasswordField
            label="Confirmar contraseña"
            autoComplete="new-password"
            icon={<LockKeyhole className="h-[18px] w-[18px]" />}
            error={passwordForm.formState.errors.confirmPassword?.message}
            {...passwordForm.register("confirmPassword")}
          />

          <AuthButton
            type="submit"
            isLoading={passwordForm.formState.isSubmitting}
            className="mt-1"
          >
            {passwordForm.formState.isSubmitting ? "Actualizando…" : "Actualizar contraseña"}
          </AuthButton>
        </form>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setFormError(null);
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
      title="Restablecer contraseña"
      subtitle={
        prefillEmail
          ? `Enviamos un código de 6 dígitos a ${prefillEmail}`
          : "Ingresa el código de 6 dígitos que recibiste por correo"
      }
    >
      <form
        onSubmit={codeForm.handleSubmit(onSubmitCode)}
        noValidate
        className="-mt-3.5 flex flex-col gap-5"
      >
        {formError && <AuthAlert>{formError}</AuthAlert>}

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
          <label className="mb-2.5 block text-center text-[15px] font-semibold uppercase tracking-[0.08em] text-ink">
            Código
          </label>
          <Controller
            control={codeForm.control}
            name="code"
            render={({ field, fieldState }) => (
              <OtpCodeInput
                value={field.value ?? ""}
                onChange={field.onChange}
                error={fieldState.error?.message}
                autoFocus
              />
            )}
          />

          <p className="mt-3 text-center text-[13px] text-zinc-500">
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
    </AuthLayout>
  );
}
