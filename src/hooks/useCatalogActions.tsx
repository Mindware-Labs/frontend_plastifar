import { useState } from "react";
import { ConfirmDialog, type ConfirmDialogProps } from "../components/ui/ConfirmDialog";

export type ConfirmRequest = Omit<ConfirmDialogProps, "onClose">;

/**
 * Estado comun a un listado con alta, edicion y acciones confirmadas por fila:
 * el dialogo abierto (`TNew` o el registro que se edita), la fila ocupada
 * mientras su accion esta en vuelo y el dialogo de confirmacion.
 *
 * `confirm(id, request)` abre la confirmacion y, al aceptar, marca la fila `id`
 * como ocupada mientras corre `onConfirm`; la libera aunque falle. Si falla, el
 * error sube al dialogo y este no se cierra. `ask(request)` abre la
 * confirmacion tal cual, sin marcar ninguna fila (acciones en lote, o las que
 * llevan su propio estado de ocupado).
 */
export function useCatalogActions<T, TNew extends string = "nuevo">() {
  const [modal, setModal] = useState<TNew | T | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmRequest | null>(null);

  function confirm(id: number, { onConfirm, ...request }: ConfirmRequest) {
    setConfirmation({
      ...request,
      onConfirm: async () => {
        setBusyId(id);
        try {
          await onConfirm();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  const dialog = confirmation && (
    <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />
  );

  return { modal, setModal, busyId, setBusyId, confirm, ask: setConfirmation, dialog };
}
