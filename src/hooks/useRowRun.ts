import { useState } from "react";
import { ApiError } from "../api/client";

/**
 * Accion sobre una fila de un catalogo cuyo fallo se avisa fuera del dialogo:
 * marca la fila ocupada, limpia el aviso anterior, relee al terminar y deja el
 * error en `actionError`. La fila se libera aunque falle.
 */
export function useRowRun(setBusyId: (id: number | null) => void, refresh: () => void) {
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(id: number, action: () => Promise<unknown>) {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      // Relee la página: totales y contadores los manda el servidor, no se adivinan aquí.
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "No se pudo completar la acción");
    } finally {
      setBusyId(null);
    }
  }

  return { actionError, run };
}
