import { useCallback, useState } from "react";

/** Coordinación de señal de salida y desmonte para componentes modales. */
export function useModalAnimation() {
  const [isExiting, setIsExiting] = useState(false);
  const requestClose = useCallback(() => setIsExiting(true), []);
  return { isExiting, requestClose };
}
