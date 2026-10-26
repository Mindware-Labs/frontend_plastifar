import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { territoriesApi } from "../../api/territories";
import { Alert } from "../../components/ui/Alert";
import { CheckboxField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { ShortcutModalFooter } from "../../components/ui/ShortcutModalFooter";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import type { Territory } from "../../types/clients";
import { FormDivider } from "../../components/ui/FormDivider";

/**
 * Espejo de la validación del servidor en POST/PUT /api/territories: código
 * único en mayúsculas y nombre único, ambos obligatorios.
 */
const schema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "El código debe tener al menos 2 caracteres")
    .max(10, "El código no puede tener más de 10 caracteres")
    .regex(/^[A-Za-z0-9_-]+$/, "Solo letras, números y guiones, sin espacios"),
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "El nombre no puede tener más de 80 caracteres"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface TerritoryModalProps {
  territory?: Territory;
  onClose: () => void;
  onSaved: (territory: Territory) => void;
}

export function TerritoryModal({ territory, onClose, onSaved }: TerritoryModalProps) {
  const isEdit = territory !== undefined;
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
      code: territory?.code ?? "",
      name: territory?.name ?? "",
      isActive: territory?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const request = {
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      isActive: values.isActive,
    };

    try {
      const saved = isEdit
        ? await territoriesApi.update(territory.id, request)
        : await territoriesApi.create(request);
      onSaved(saved);
      requestClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const message = err.message.toLowerCase();
        if (message.includes(request.code.toLowerCase())) {
          setError("code", { message: err.message });
          setFocus("code");
        } else if (message.includes(request.name.toLowerCase())) {
          setError("name", { message: err.message });
          setFocus("name");
        } else {
          setFormError(err.message);
        }
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar el territorio");
    }
  }

  return (
    <Modal
      maxWidth="max-w-md"
      eyebrow={isEdit ? `Territorio #${territory.id} · ${territory.code}` : "Zona comercial"}
      title={isEdit ? `Editar ${territory.name}` : "Nuevo territorio"}
      description={
        isEdit
          ? "Actualiza el código o la denominación de esta zona comercial."
          : "Define el código y nombre para clasificar clientes y fuerza de ventas."
      }
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <ShortcutModalFooter
          formId="territory-form"
          isEdit={isEdit}
          createLabel="Crear territorio"
          isSubmitting={isSubmitting}
          onCancel={requestClose}
        />
      }
    >
      <form
        id="territory-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <FormDivider title="Información de la zona" tight />

        <TextField
          size="sm"
          label="Código"
          placeholder="Ej. SDQ"
          required
          state={stateOf("code")}
          error={errors.code?.message}
          hint="En mayúsculas (2 a 10 caracteres)."
          className="uppercase font-mono tracking-wider"
          {...register("code", {
            onChange: (e) => {
              e.target.value = e.target.value.toUpperCase();
            },
          })}
        />

        <TextField
          size="sm"
          label="Nombre del territorio"
          placeholder="Ej. Santo Domingo"
          required
          state={stateOf("name")}
          error={errors.name?.message}
          {...register("name")}
        />

        {isEdit && (
          <>
            <FormDivider title="Estado" tight />

            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-2.5">
              <CheckboxField
                label="Territorio activo"
                description="Si se desmarca, deja de ofrecerse al registrar o editar clientes."
                {...register("isActive")}
              />
            </div>

            {territory.clientCount > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/70 bg-amber-50/60 p-2.5 text-[11.5px] leading-relaxed text-amber-900">
                <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-950">
                    {territory.clientCount}{" "}
                    {territory.clientCount === 1 ? "cliente asignado" : "clientes asignados"}.
                  </span>{" "}
                  Desactivarlo conserva su historial y métricas, pero no se podrá seleccionar en nuevos clientes.
                </div>
              </div>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
