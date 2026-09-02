import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { tokenStore } from "../../api/tokenStore";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField, type FieldState } from "../ui/Field";
import { Modal } from "../ui/Modal";

// Espejo de PasswordPolicy.cs: si cambia alla, cambia aqui.
const schema = z
  .object({
    currentPassword: z.string().min(1, "Escribe tu contraseña actual"),
    newPassword: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .max(128, "Máximo 128 caracteres")
      .regex(/[a-zA-Z]/, "Debe incluir al menos una letra")
      .regex(/[0-9]/, "Debe incluir al menos un número"),
    confirmPassword: z.string().min(1, "Repite la nueva contraseña"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    message: "La nueva contraseña debe ser distinta de la actual",
    path: ["newPassword"],
  });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched" });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        // Esta sesión sobrevive; el servidor cierra las demás.
        refreshToken: tokenStore.getRefreshToken(),
      });
      setDone(true);
    } catch (err) {
      // Cada rechazo del servidor se marca en el campo que lo provoca, no en un
      // aviso general: "no es correcta" es la actual, "distinta de la actual" es la nueva.
      if (err instanceof ApiError) {
        const message = err.message.toLowerCase();

        if (message.includes("no es correcta")) {
          setError("currentPassword", { message: err.message });
          setFocus("currentPassword");
          return;
        }

        if (message.includes("distinta") || message.includes("debe tener")) {
          setError("newPassword", { message: err.message });
          setFocus("newPassword");
          return;
        }
      }

      setFormError(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña");
    }
  }

  if (done) {
    return (
      <Modal
        eyebrow="Mi cuenta"
        title="Contraseña actualizada"
        onClose={onClose}
        footer={
          <Button type="button" onClick={onClose}>
            Entendido
          </Button>
        }
      >
        <Alert variant="success">
          Tu contraseña se cambió correctamente. Las demás sesiones abiertas se cerraron; esta
          sigue activa.
        </Alert>
      </Modal>
    );
  }

  return (
    <Modal
      eyebrow="Mi cuenta"
      title="Cambiar contraseña"
      description="Al guardar se cierran tus otras sesiones abiertas. Esta se mantiene."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="change-password-form" isLoading={isSubmitting}>
            Guardar contraseña
          </Button>
        </>
      }
    >
      <form
        id="change-password-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          required
          state={stateOf("currentPassword")}
          error={errors.currentPassword?.message}
          {...register("currentPassword")}
        />

        <TextField
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          required
          state={stateOf("newPassword")}
          error={errors.newPassword?.message}
          hint="Al menos 8 caracteres, con una letra y un número."
          {...register("newPassword")}
        />

        <TextField
          label="Repetir nueva contraseña"
          type="password"
          autoComplete="new-password"
          required
          state={stateOf("confirmPassword")}
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
      </form>
    </Modal>
  );
}
