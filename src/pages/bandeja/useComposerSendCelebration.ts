import { useEffect, useRef, useState } from "react";

export type ComposerSendCelebrationKind = "compose" | "reply" | "forward" | "queued";

export interface ComposerSendCelebrationPayload {
  title: string;
  detail: string;
  kind?: ComposerSendCelebrationKind;
  subject?: string;
  attachmentsCount?: number;
}

/** Tiempo visible de la confirmación de envío (bandeja). */
export const COMPOSER_SEND_CELEBRATION_MS = 4500;

/** Respuesta desde ticket: un segundo menos que bandeja. */
export const TICKET_REPLY_SEND_CELEBRATION_MS = 3500;
const EXIT_LEAD_MS = 240;

export function useComposerSendCelebration(celebrationMs = COMPOSER_SEND_CELEBRATION_MS) {
  const [celebration, setCelebration] = useState<ComposerSendCelebrationPayload | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  function celebrate(payload: ComposerSendCelebrationPayload, onComplete: () => void) {
    setCelebration(payload);
    setIsExiting(false);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);

    const exitDelay = Math.max(0, celebrationMs - Math.min(EXIT_LEAD_MS, Math.floor(celebrationMs * 0.2)));
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      setIsExiting(true);
    }, exitDelay);

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onComplete();
      setCelebration(null);
      setIsExiting(false);
    }, celebrationMs);
  }

  return {
    celebration,
    celebrate,
    isCelebrating: celebration !== null,
    isExiting,
  };
}
