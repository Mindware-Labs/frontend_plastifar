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
import { AuthLayout } from "../../layouts/AuthLayout";

const schema = z
  .object({
    email: z.string().min(1, "Ingresa tu correo").email("Correo inválido"),
    code: z.string().regex(/^\d{6}$/, "El código son 6 dígitos"),
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

type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const prefillEmail = (location.state as { email?: string } | null)?.email ?? "";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: prefillEmail },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await authApi.resetPassword(values);
      setDone(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Código inválido o expirado");
    }
  }

  if (done) {
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

  return (
    <AuthLayout
      title="Restablecer contraseña"
      subtitle="Ingresa el código de 6 dígitos que recibiste por correo"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <Input
          label="Correo"
          type="email"
          autoComplete="username"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="Código de 6 dígitos"
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          error={errors.code?.message}
          {...register("code")}
        />
        <Input
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />
        <Input
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
          Actualizar contraseña
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
