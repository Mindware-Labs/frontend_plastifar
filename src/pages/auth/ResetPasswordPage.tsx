import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { PasswordInput } from "../../components/ui/PasswordInput";
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
        <Alert variant="success">
          Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.
        </Alert>
        <Button className="mt-6 w-full" onClick={() => navigate("/login", { replace: true })}>
          Ir a iniciar sesión
        </Button>
      </AuthLayout>
    );
  }

  if (step === "password") {
    return (
      <AuthLayout title="Nueva contraseña" subtitle={`Código verificado para ${verified?.email}`}>
        <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="flex flex-col gap-4">
          {formError && <Alert variant="error">{formError}</Alert>}

          <PasswordInput
            label="Nueva contraseña"
            autoComplete="new-password"
            error={passwordForm.formState.errors.newPassword?.message}
            {...passwordForm.register("newPassword")}
          />
          <PasswordInput
            label="Confirmar contraseña"
            autoComplete="new-password"
            error={passwordForm.formState.errors.confirmPassword?.message}
            {...passwordForm.register("confirmPassword")}
          />

          <Button
            type="submit"
            isLoading={passwordForm.formState.isSubmitting}
            className="mt-2 w-full"
          >
            Actualizar contraseña
          </Button>

          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setStep("code");
            }}
            className="text-center text-sm font-medium text-brand-gray hover:text-brand-red"
          >
            Volver a ingresar el código
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Restablecer contraseña"
      subtitle={
        prefillEmail
          ? `Enviamos un código a ${prefillEmail}`
          : "Ingresa el código de 6 dígitos que recibiste por correo"
      }
    >
      <form onSubmit={codeForm.handleSubmit(onSubmitCode)} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        {prefillEmail ? (
          <input type="hidden" {...codeForm.register("email")} />
        ) : (
          <Input
            label="Correo"
            type="email"
            autoComplete="username"
            error={codeForm.formState.errors.email?.message}
            {...codeForm.register("email")}
          />
        )}
        <Input
          label="Código de 6 dígitos"
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          error={codeForm.formState.errors.code?.message}
          {...codeForm.register("code")}
        />

        <Button type="submit" isLoading={codeForm.formState.isSubmitting} className="mt-2 w-full">
          Verificar código
        </Button>

        <Link
          to="/login"
          className="text-center text-sm font-medium text-brand-gray hover:text-brand-red"
        >
          Volver a iniciar sesión
        </Link>
      </form>
    </AuthLayout>
  );
}
