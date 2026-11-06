import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextField, type FieldState } from "../../components/ui/Field";
import { AuthLayout, authBackLinkClass } from "../../layouts/AuthLayout";

const schema = z.object({
  email: z.string().min(1, "Ingresa tu correo").email("Correo inválido"),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const prefilledEmail = (location.state as { email?: string } | null)?.email ?? "";

  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { email: prefilledEmail },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

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
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3.5">
        {formError && <Alert variant="error">{formError}</Alert>}

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
          error={errors.email?.message}
          {...register("email")}
        />

        <Button type="submit" isLoading={isSubmitting} className="mt-1 w-full">
          {isSubmitting ? "Enviando…" : "Enviar código"}
        </Button>
      </form>

      <div className="mt-7 flex justify-center border-t border-line pt-6">
        <Link to="/login" className={authBackLinkClass}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a iniciar sesión
        </Link>
      </div>
    </AuthLayout>
  );
}
