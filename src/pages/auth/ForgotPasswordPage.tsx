import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { AuthAlert } from "../../components/auth/AuthAlert";
import { AuthButton } from "../../components/auth/AuthButton";
import { AuthField } from "../../components/auth/AuthField";
import { AuthLayout } from "../../layouts/AuthLayout";

const schema = z.object({
  email: z.string().min(1, "Ingresa tu correo").email("Correo inválido"),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await authApi.forgotPassword(values);
      navigate("/reset-password", { state: { email: values.email } });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Algo salió mal");
    }
  }

  return (
    <AuthLayout
      title="Recuperar contraseña"
      subtitle="Te enviaremos un código de 6 dígitos al correo asociado a tu cuenta"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {formError && <AuthAlert>{formError}</AuthAlert>}

        <AuthField
          label="Correo corporativo"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoFocus
          icon={<Mail className="h-[18px] w-[18px]" />}
          error={errors.email?.message}
          {...register("email")}
        />

        <AuthButton type="submit" isLoading={isSubmitting} className="mt-1">
          {isSubmitting ? "Enviando…" : "Enviar código"}
        </AuthButton>
      </form>

      <div className="mt-8 flex justify-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 rounded text-[13.5px] font-medium text-brand-gray transition-colors hover:text-brand-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a iniciar sesión
        </Link>
      </div>
    </AuthLayout>
  );
}
