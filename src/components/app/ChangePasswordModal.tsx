import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { tokenStore } from "../../api/tokenStore";
import { evaluatePassword, passwordSchema } from "../../lib/password";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { PasswordField, type FieldState } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { PasswordStrength } from "../ui/PasswordStrength";

const currentSchema = z.object({
  currentPassword: z.string().min(1, "Escribe tu contraseña actual"),
});
type CurrentFormValues = z.infer<typeof currentSchema>;

const newSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Repite la nueva contraseña"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });
type NewFormValues = z.infer<typeof newSchema>;

type Step = "actual" | "nueva" | "listo";

/**
 * Cambio de contrasena en dos pasos: primero se confirma la actual contra el
 * servidor y solo entonces se pide la nueva. Asi nadie escribe una contrasena
 * nueva para descubrir al final que la actual estaba mal.
 */
export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("actual");
  const [currentPassword, setCurrentPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const currentForm = useForm<CurrentFormValues>({
    resolver: zodResolver(currentSchema),
    mode: "onTouched",
  });

  const newForm = useForm<NewFormValues>({
    resolver: zodResolver(newSchema),
    mode: "onTouched",
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  // useWatch en vez de form.watch: se suscribe al campo sin romper la memoizacion.
  const newPassword = useWatch({ control: newForm.control, name: "newPassword" }) ?? "";
  const strength = evaluatePassword(newPassword);

  // Al cambiar de paso el foco va al primer campo del paso nuevo.
  useEffect(() => {
    if (step === "nueva") newForm.setFocus("newPassword");
  }, [step, newForm]);

  async function onSubmitCurrent(values: CurrentFormValues) {
    setFormError(null);
    try {
      await authApi.verifyPassword({ password: values.currentPassword });
      setCurrentPassword(values.currentPassword);
      setStep("nueva");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        currentForm.setError("currentPassword", { message: err.message });
        currentForm.setFocus("currentPassword");
        return;
      }
      setFormError(
        err instanceof ApiError ? err.message : "No se pudo verificar la contraseña",
      );
    }
  }

  async function onSubmitNew(values: NewFormValues) {
    setFormError(null);
    try {
      await authApi.changePassword({
        currentPassword,
        newPassword: values.newPassword,
        // Esta sesión sobrevive; el servidor cierra las demás.
        refreshToken: tokenStore.getRefreshToken(),
      });
      setStep("listo");
    } catch (err) {
      if (err instanceof ApiError) {
        // La actual dejó de ser válida entre un paso y otro: se vuelve al principio.
        if (err.code === "wrong_current_password") {
          setStep("actual");
          setCurrentPassword("");
          currentForm.setError("currentPassword", { message: err.message });
          return;
        }

        if (err.code === "same_password" || err.code === "weak_password") {
          newForm.setError("newPassword", { message: err.message });
          newForm.setFocus("newPassword");
          return;
        }
      }

      setFormError(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña");
    }
  }

  if (step === "listo") {
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

  if (step === "actual") {
    return (
      <Modal
        eyebrow="Mi cuenta · Paso 1 de 2"
        title="Confirma tu contraseña"
        description="Antes de cambiarla, escribe la contraseña con la que entras hoy."
        onClose={onClose}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="current-password-form"
              isLoading={currentForm.formState.isSubmitting}
            >
              Continuar
            </Button>
          </>
        }
      >
        <form
          id="current-password-form"
          onSubmit={currentForm.handleSubmit(onSubmitCurrent)}
          noValidate
          className="flex flex-col gap-4"
        >
          {formError && <Alert variant="error">{formError}</Alert>}

          <PasswordField
            label="Contraseña actual"
            autoComplete="current-password"
            required
            error={currentForm.formState.errors.currentPassword?.message}
            {...currentForm.register("currentPassword")}
          />
        </form>
      </Modal>
    );
  }

  const confirmState: FieldState =
    newForm.formState.errors.confirmPassword
      ? "error"
      : newForm.formState.touchedFields.confirmPassword
        ? "valid"
        : "idle";

  return (
    <Modal
      eyebrow="Mi cuenta · Paso 2 de 2"
      title="Crea una contraseña"
      description="Debe cumplir todos los requisitos. Al guardar se cierran tus otras sesiones."
      onClose={onClose}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setFormError(null);
              setStep("actual");
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Atrás
          </Button>
          <Button
            type="submit"
            form="new-password-form"
            isLoading={newForm.formState.isSubmitting}
            // Igual que la referencia: no se puede enviar hasta cumplir las cuatro reglas.
            disabled={!strength.isValid}
          >
            Guardar contraseña
          </Button>
        </>
      }
    >
      <form
        id="new-password-form"
        onSubmit={newForm.handleSubmit(onSubmitNew)}
        noValidate
        className="flex flex-col gap-4"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <PasswordField
          label="Nueva contraseña"
          autoComplete="new-password"
          required
          state={strength.isValid ? "valid" : "idle"}
          error={newForm.formState.errors.newPassword?.message}
          {...newForm.register("newPassword")}
        />

        <PasswordField
          label="Repetir nueva contraseña"
          autoComplete="new-password"
          required
          state={confirmState}
          error={newForm.formState.errors.confirmPassword?.message}
          {...newForm.register("confirmPassword")}
        />

        <PasswordStrength value={newPassword} className="mt-1" />
      </form>
    </Modal>
  );
}
