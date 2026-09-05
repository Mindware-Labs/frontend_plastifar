import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { suppressionsApi } from "../../api/suppressions";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useModalAnimation } from "../../hooks/useModalAnimation";

const schema = z.object({
  address: z.string().trim().email("Escribe una dirección válida"),
  detail: z.string().trim().max(500, "Máximo 500 caracteres"),
});

type FormValues = z.infer<typeof schema>;

interface SuppressionModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export function SuppressionModal({ onClose, onSaved }: SuppressionModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const { isExiting, requestClose } = useModalAnimation(onClose);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { address: "", detail: "" },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await suppressionsApi.create(values.address, values.detail);
      onSaved();
      requestClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("address", { message: err.message });
        setFocus("address");
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "No se pudo bloquear la dirección");
    }
  }

  return (
    <Modal
      eyebrow="Correo · Supresión"
      title="Bloquear dirección"
      description="A partir de ahora ningún correo saldrá hacia esta dirección hasta que un administrador la desbloquee."
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={requestClose}>
            Cancelar
          </Button>
          <Button type="submit" form="suppression-form" isLoading={isSubmitting}>
            Bloquear
          </Button>
        </>
      }
    >
      <form id="suppression-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Dirección"
          placeholder="correo@dominio.com"
          required
          autoFocus
          state={stateOf("address")}
          error={errors.address?.message}
          {...register("address")}
        />

        <TextField
          label="Motivo"
          placeholder="Ej. pidió no recibir más correos"
          state={stateOf("detail")}
          error={errors.detail?.message}
          hint="Opcional. Se ve en la lista para saber por qué está bloqueada."
          {...register("detail")}
        />
      </form>
    </Modal>
  );
}
