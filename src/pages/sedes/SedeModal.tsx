import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState, type KeyboardEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { ApiError } from "../../api/client";
import { sedesApi } from "../../api/sedes";
import { Alert } from "../../components/ui/Alert";
import { CheckboxField, TextField, type FieldState } from "../../components/ui/Field";
import { FormDivider } from "../../components/ui/FormDivider";
import { FormModalFooter } from "../../components/ui/FormModalFooter";
import { Modal } from "../../components/ui/Modal";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { buildValidationItems, focusFormField } from "../../lib/validationItems";
import { fieldForServerError, type FieldRule } from "../../lib/serverFieldErrors";
import type { Sede } from "../../types/sedes";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Al menos 2 caracteres")
    .max(80, "Máximo 80 caracteres"),
  address: z.string().trim().max(200, "Máximo 200 caracteres"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const fieldRules: FieldRule<keyof FormValues>[] = [
  { field: "address", matches: ["direccion", "dirección", "ubicacion", "ubicación"] },
  { field: "name", matches: ["nombre"] },
];

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
    control,
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

  const sedeName = useWatch({ control, name: "name" }) ?? "";
  const sedeFormMissing = useMemo(
    () =>
      buildValidationItems([
        {
          id: "name",
          label: "Falta el nombre de la sede",
          short: "el nombre",
          valid: sedeName.trim().length >= 2,
        },
      ]),
    [sedeName],
  );

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit(onSubmit)();
    }
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const request = {
      name: values.name.trim(),
      address: values.address.trim() === "" ? null : values.address.trim(),
      isActive: values.isActive,
    };

    try {
      const saved = isEdit
        ? await sedesApi.update(sede.id, request)
        : await sedesApi.create(request);
      onSaved(saved);
      requestClose();
    } catch (err) {
      const field = fieldForServerError(err, fieldRules);
      if (field) {
        setError(field.field, { message: field.message });
        setFocus(field.field);
        return;
      }

      const fallback = isEdit ? "No se pudo guardar la sede" : "No se pudo crear la sede";
      setFormError(err instanceof ApiError ? err.message : fallback);
    }
  }

  return (
    <Modal
      maxWidth="max-w-xl"
      eyebrow={
        isEdit
          ? `Sede #${sede.id} · ${sede.departmentCount} ${sede.departmentCount === 1 ? "departamento" : "departamentos"}`
          : "Catálogo de sedes físicas"
      }
      title={isEdit ? `Editar ${sede.name}` : "Nueva sede"}
      description={
        isEdit
          ? "Actualiza la denominación o la dirección de esta sede."
          : "Registra una planta o ubicación para asociarle departamentos."
      }
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <FormModalFooter
          formId="sede-form"
          isEdit={isEdit}
          createLabel="Crear sede"
          isSubmitting={isSubmitting}
          onCancel={requestClose}
          size="sm"
          submit={
            <SubmitValidationButton
              formId="sede-form"
              ready={sedeFormMissing.length === 0}
              busy={isSubmitting}
              missingItems={sedeFormMissing}
              onFocusField={focusFormField}
              hintText="Para guardar la sede, completa lo siguiente:"
            >
              {isEdit ? "Guardar cambios" : "Crear sede"}
            </SubmitValidationButton>
          }
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

        <FormDivider title="Identificación" />

        <TextField
          size="sm"
          label="Nombre de la sede"
          placeholder="Ej. Planta Envases, Sede Central, Plastifar Oeste"
          required
          autoFocus
          state={stateOf("name")}
          error={errors.name?.message}
          {...register("name")}
        />

        <FormDivider title="Ubicación" />

        <TextField
          size="sm"
          label="Dirección física"
          placeholder="Calle, número, sector o parque industrial (opcional)"
          state={stateOf("address")}
          error={errors.address?.message}
          {...register("address")}
        />

        {isEdit && (
          <CheckboxField
            label="Sede activa"
            description="Si se desmarca, no se podrá elegir al crear o editar departamentos."
            {...register("isActive")}
          />
        )}
      </form>
    </Modal>
  );
}
