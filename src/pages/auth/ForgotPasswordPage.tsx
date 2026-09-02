import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
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
      title="Olvidé mi contraseña"
      subtitle="Te enviaremos un código de 6 dígitos a tu correo"
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

        <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
          Enviar código
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
