import { Button } from "./Button";

interface ShortcutModalFooterProps {
  /** id del <form> que envia el boton principal. */
  formId: string;
  isEdit: boolean;
  /** Texto del boton en un alta, p. ej. «Crear cliente». */
  createLabel: string;
  isSubmitting: boolean;
  onCancel: () => void;
}

/**
 * Pie de un dialogo de alta/edicion con el atajo «Ctrl + Enter para guardar»
 * a la izquierda y Cancelar y el envio a la derecha.
 */
export function ShortcutModalFooter({ formId, isEdit, createLabel, isSubmitting, onCancel }: ShortcutModalFooterProps) {
  return (
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
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" form={formId} size="sm" isLoading={isSubmitting}>
          {isEdit ? "Guardar cambios" : createLabel}
        </Button>
      </div>
    </div>
  );
}
