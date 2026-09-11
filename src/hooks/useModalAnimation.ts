import { useCallback, useState } from "react";

/**
 * Señal de cierre para quien monta un <Modal> y necesita cerrarlo desde su propia
 * lógica (tras guardar, al cancelar). `requestClose` marca la salida; el Modal la
 * anima con useDialogMotion y llama a onClose cuando termina.
 */
export function useModalAnimation() {
  const [isExiting, setIsExiting] = useState(false);
  const requestClose = useCallback(() => setIsExiting(true), []);
  return { isExiting, requestClose };
}
