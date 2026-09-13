import { useCallback, useEffect, useRef, useState } from "react";

export type UploadPhase = "idle" | "entering" | "active" | "exiting";

interface UseUploadFeedbackOptions {
  /** Tiempo total que permanece visible antes de iniciar la salida (ms). Por defecto 2200. */
  duration?: number;
  /** Duración de la animación de salida suave (ms). Por defecto 380. */
  exitDuration?: number;
}

/**
 * Controla el ciclo completo de retroalimentación de carga con 3 fases continuas:
 * 1. Entrada suave (`entering`)
 * 2. Desarrollo suave / respiración (`active`)
 * 3. Salida suave con desvanecimiento (`exiting`) -> reposo (`idle`)
 */
export function useUploadFeedback(options: UseUploadFeedbackOptions = {}) {
  const { duration = 2200, exitDuration = 380 } = options;
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    if (exitTimer.current) clearTimeout(exitTimer.current);
    if (idleTimer.current) clearTimeout(idleTimer.current);

    // Fase 1: Entrada suave
    setPhase("entering");

    // Fase 2: Desarrollo suave continuo
    enterTimer.current = setTimeout(() => {
      setPhase("active");
    }, 450);

    // Fase 3: Salida suave
    exitTimer.current = setTimeout(() => {
      setPhase("exiting");

      // Vuelta al reposo
      idleTimer.current = setTimeout(() => {
        setPhase("idle");
      }, exitDuration);
    }, duration);
  }, [duration, exitDuration]);

  const reset = useCallback(() => {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    if (exitTimer.current) clearTimeout(exitTimer.current);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setPhase("idle");
  }, []);

  useEffect(() => {
    return () => {
      if (enterTimer.current) clearTimeout(enterTimer.current);
      if (exitTimer.current) clearTimeout(exitTimer.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  return {
    phase,
    isShowing: phase !== "idle",
    isExiting: phase === "exiting",
    trigger,
    reset,
  };
}
