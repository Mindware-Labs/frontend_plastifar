import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, Lock, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { AuthAlert } from "../../components/auth/AuthAlert";
import { AuthButton } from "../../components/auth/AuthButton";
import { AuthField, AuthPasswordField } from "../../components/auth/AuthField";
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

const backLinkClass =
  "inline-flex items-center gap-1.5 rounded text-[13.5px] font-medium text-brand-gray transition-colors hover:text-brand-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<Step>("code");
  const [formError, setFormError] = useState<string | null>(null);
  // Solo se llena tras una verificación exitosa del código: es lo que habilita el paso 2.
  const [verified, setVerified] = useState<{ email: string; code: string } | null>(null);

  const prefillEmail = (location.state as { email?: string } | null)?.email ?? "";

  const codeForm = useForm<CodeFormValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { email: prefillEmail },
  });

  const passwordForm = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) });

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
      <form onSubmit={codeForm.handleSubmit(onSubmitCode)} noValidate className="flex flex-col gap-5">
        {formError && <AuthAlert>{formError}</AuthAlert>}

        {prefillEmail ? (
          <input type="hidden" {...codeForm.register("email")} />
        ) : (
          <AuthField
            label="Correo corporativo"
            type="email"
            inputMode="email"
            autoComplete="username"
            icon={<Mail className="h-[18px] w-[18px]" />}
            error={codeForm.formState.errors.email?.message}
            {...codeForm.register("email")}
          />
        )}

        <AuthField
          label="Código de verificación"
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus
          icon={<KeyRound className="h-[18px] w-[18px]" />}
          className="font-heading font-semibold tracking-[0.42em] placeholder:font-normal"
          style={{ fontSize: "19px" }}
          error={codeForm.formState.errors.code?.message}
          {...codeForm.register("code")}
        />

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
