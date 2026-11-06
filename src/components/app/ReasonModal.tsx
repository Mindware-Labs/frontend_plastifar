import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { buildValidationItems, focusFormField } from "../../lib/validationItems";
import { SubmitValidationButton } from "./SubmitValidationButton";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextAreaField } from "../ui/Field";
import { Modal } from "../ui/Modal";

export interface ReasonField {
  label: string;
  placeholder?: string;
  /** Mínimo de caracteres. Sin él, el texto es opcional y vacío se envía como null. */
  min?: number;
  /** Mensaje cuando no llega al mínimo, en la voz de la acción: «Explica por qué se anula…». */
  minMessage?: string;
  max: number;
  defaultValue?: string;
}

interface ReasonModalProps {
  title: string;
  description: string;
  field: ReasonField;
  submitLabel: string;
  /** Lo destructivo va en `danger`; aprobar o reabrir, en `primary`. */
  submitVariant?: "primary" | "danger";
  cancelLabel?: string;
  /** Texto de error cuando el servidor no da uno. */
  fallbackError: string;
  /** Envía el texto ya recortado (null si es opcional y quedó vacío). Debe lanzar si falla. */
  onSubmit: (text: string | null) => Promise<void>;
  onClose: () => void;
  /**
   * 409: el registro cambió en el servidor mientras el modal estaba abierto.
   * Si se pasa, el modal se cierra y quien lo abrió recarga y muestra el mensaje.
   */
  onConflict?: (message: string) => void;
  /** Contexto que va antes del campo: avisos, resumen del registro. */
  children?: ReactNode;
  /** Contexto que va después del campo. */
  afterField?: ReactNode;
}

/**
 * Un modal que pide un texto justificativo antes de una acción: cancelar,
 * anular, reabrir, aprobar o rechazar con nota. La validación es espejo de la
 * del servidor; lo que cambia de un módulo a otro son los textos y la llamada.
 */
export function ReasonModal({
  title,
  description,
  field,
  submitLabel,
  submitVariant = "primary",
  cancelLabel = "Cancelar",
  fallbackError,
  onSubmit,
  onClose,
  onConflict,
  children,
  afterField,
}: ReasonModalProps) {
  const formId = useId();
  const reasonFieldId = `${formId}-text`;
  const [formError, setFormError] = useState<string | null>(null);

  const maxMessage = `Máximo ${field.max} caracteres`;
  const text = z.string().trim().max(field.max, maxMessage);
  const schema = z.object({
    text: field.min ? text.min(field.min, field.minMessage ?? `Al menos ${field.min} caracteres`) : text,
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { text: field.defaultValue ?? "" },
  });

  const textValue = watch("text") ?? "";
  const reasonMissing = useMemo(() => {
    if (!field.min) return [];
    const trimmed = textValue.trim();
    return buildValidationItems([
      {
        id: reasonFieldId,
        label: field.minMessage ?? `Completa «${field.label}» (mín. ${field.min} caracteres)`,
        short: field.label.toLowerCase(),
        valid: trimmed.length >= field.min,
      },
    ]);
  }, [field.label, field.min, field.minMessage, reasonFieldId, textValue]);

  async function submit(values: z.infer<typeof schema>) {
    setFormError(null);
    const trimmed = values.text.trim();
    try {
      await onSubmit(trimmed === "" ? null : trimmed);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && onConflict) {
        onConflict(err.message);
        onClose();
        return;
      }
      setFormError(err instanceof ApiError ? err.message : fallbackError);
    }
  }

  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <SubmitValidationButton
            formId={formId}
            ready={reasonMissing.length === 0}
            busy={isSubmitting}
            missingItems={reasonMissing}
            onFocusField={focusFormField}
            variant={submitVariant}
            hintText="Para continuar, completa lo siguiente:"
          >
            {submitLabel}
          </SubmitValidationButton>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        {children}
        <TextAreaField
          id={reasonFieldId}
          label={field.label}
          required={Boolean(field.min)}
          rows={3}
          placeholder={field.placeholder}
          error={errors.text?.message}
          {...register("text")}
        />
        {afterField}
      </form>
    </Modal>
  );
}
