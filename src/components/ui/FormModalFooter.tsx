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
  /**
   * El dialogo guarda tambien con Ctrl + Enter. El atajo se anuncia en el
   * tooltip y en `aria-keyshortcuts` del boton, no como texto en el pie.
   */
  shortcut?: boolean;
  /** Tamano de los dos botones; por defecto el del Button. */
  size?: "sm" | "md";
  /**
   * Sustituye el boton de envio por uno propio (p. ej. SubmitValidationButton,
   * que explica que falta antes de guardar). Cancelar se mantiene igual.
   */
  submit?: ReactNode;
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
  shortcut = false,
  size,
  submit,
  children,
}: FormModalFooterProps) {
  return (
    <>
      {children}
      <Button type="button" variant="secondary" size={size} onClick={onCancel}>
        {cancelLabel}
      </Button>
      {submit ?? (
        <Button
          type="submit"
          form={formId}
          size={size}
          isLoading={isSubmitting}
          title={shortcut ? "Ctrl + Enter" : undefined}
          aria-keyshortcuts={shortcut ? "Control+Enter" : undefined}
        >
          {isEdit ? editLabel : createLabel}
        </Button>
      )}
    </>
  );
}
