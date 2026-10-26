import type { ReactNode } from "react";
import { Button } from "./Button";

interface FormModalFooterProps {
  /** id del <form> que envia el boton principal. */
  formId: string;
  isEdit: boolean;
  /** Texto del boton en un alta, p. ej. «Crear planta». */
  createLabel: string;
  editLabel?: string;
  cancelLabel?: string;
  isSubmitting: boolean;
  onCancel: () => void;
  /** Acciones secundarias antes de Cancelar (vista previa, etc.). */
  children?: ReactNode;
}

/** Pie de un dialogo de alta/edicion: Cancelar y el envio del formulario. */
export function FormModalFooter({
  formId,
  isEdit,
  createLabel,
  editLabel = "Guardar cambios",
  cancelLabel = "Cancelar",
  isSubmitting,
  onCancel,
  children,
}: FormModalFooterProps) {
  return (
    <>
      {children}
      <Button type="button" variant="secondary" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button type="submit" form={formId} isLoading={isSubmitting}>
        {isEdit ? editLabel : createLabel}
      </Button>
    </>
  );
}
