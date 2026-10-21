import { zodResolver } from "@hookform/resolvers/zod";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { sedesApi } from "../../api/sedes";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, TextAreaField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import type { Sede } from "../../types/sedes";

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

function FormDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 first:border-0 first:pt-0">
      <span className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400 select-none">
        {title}
      </span>
      <div className="h-px flex-1 bg-zinc-100" />
    </div>
  );
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
      maxWidth="max-w-md"
      eyebrow={isEdit ? `Sede #${sede.id}` : "Organización"}
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
        <div className="flex w-full items-center justify-between gap-3">
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400 select-none">
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Enter
            </kbd>
            <span className="ml-0.5">para guardar</span>
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
              Cancelar
            </Button>
            <Button type="submit" form="sede-form" size="sm" isLoading={isSubmitting}>
              {isEdit ? "Guardar cambios" : "Crear sede"}
            </Button>
          </div>
        </div>
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

        <FormDivider title="Información Principal" />

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
            <FormDivider title="Estado" />
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
