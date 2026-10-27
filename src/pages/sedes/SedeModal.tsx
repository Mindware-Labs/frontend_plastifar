import { zodResolver } from "@hookform/resolvers/zod";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { sedesApi } from "../../api/sedes";
import { Alert } from "../../components/ui/Alert";
import { CheckboxField, TextAreaField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { FormModalFooter } from "../../components/ui/FormModalFooter";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import type { Sede } from "../../types/sedes";
import { FormDivider } from "../../components/ui/FormDivider";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "El nombre no puede tener más de 80 caracteres"),
  address: z.string().trim().max(200, "Máximo 200 caracteres").optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface SedeModalProps {
  sede?: Sede;
  onClose: () => void;
  onSaved: (sede: Sede) => void;
}

export function SedeModal({ sede, onClose, onSaved }: SedeModalProps) {
  const isEdit = sede !== undefined;
  const [formError, setFormError] = useState<string | null>(null);
  const { isExiting, requestClose } = useModalAnimation();

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: sede?.name ?? "",
      address: sede?.address ?? "",
      isActive: sede?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit(onSubmit)();
    }
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const request = {
      name: values.name.trim(),
      address: values.address?.trim() || null,
      isActive: values.isActive,
    };

    try {
      const saved = isEdit
        ? await sedesApi.update(sede.id, request)
        : await sedesApi.create(request);
      onSaved(saved);
      requestClose();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 400)) {
        const message = err.message.toLowerCase();
        if (message.includes("nombre")) {
          setError("name", { message: err.message });
          setFocus("name");
        } else {
          setFormError(err.message);
        }
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar la sede");
    }
  }

  return (
    <Modal
      size="sm"
      title={isEdit ? `Editar ${sede.name}` : "Nueva sede"}
      description={
        isEdit
          ? "Actualiza la denominación o dirección de esta sede corporativa."
          : "Define una sede física o planta para agrupar los departamentos de la empresa."
      }
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <FormModalFooter
          shortcut
          formId="sede-form"
          isEdit={isEdit}
          createLabel="Crear sede"
          isSubmitting={isSubmitting}
          onCancel={requestClose}
        />
      }
    >
      <form
        id="sede-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <FormDivider title="Información Principal" tight />

        <TextField
          size="sm"
          label="Nombre de la sede"
          placeholder="Ej. Plastifar Centroamérica, Sede Central, Planta 2"
          required
          autoFocus
          state={stateOf("name")}
          error={errors.name?.message}
          {...register("name")}
        />

        <TextAreaField
          label="Dirección / Ubicación"
          placeholder="Ej. Km 12 Carretera Sánchez, Santo Domingo Oeste (opcional)"
          rows={2}
          error={errors.address?.message}
          {...register("address")}
        />

        {isEdit && (
          <>
            <FormDivider title="Estado" tight />
            <CheckboxField
              label="Sede activa"
              description="Si se desmarca, no se podrá seleccionar al crear o editar departamentos."
              {...register("isActive")}
            />
          </>
        )}
      </form>
    </Modal>
  );
}
