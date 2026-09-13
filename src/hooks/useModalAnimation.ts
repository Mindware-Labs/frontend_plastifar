import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook para coordinar la animación de salida de modales y diálogos.
 * Da un margen de 180 ms para que se reproduzca .animate-plf-modal-out
 * y .animate-plf-scrim-out antes de invocar onClose y desmontar el componente del DOM.
 */
export function useModalAnimation(onClose: () => void, duration = 180) {
  const [isExiting, setIsExiting] = useState(false);
  const isExitingRef = useRef(false);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    setIsExiting(true);
  }, []);

  useEffect(() => {
    if (!isExiting) return;
    const timer = window.setTimeout(() => {
      closeRef.current();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [isExiting, duration]);

  return { isExiting, requestClose };
}
