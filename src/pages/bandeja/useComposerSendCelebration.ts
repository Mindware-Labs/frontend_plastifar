import { useEffect, useRef, useState } from "react";

export type ComposerSendCelebrationKind = "compose" | "reply" | "forward" | "queued";

export interface ComposerSendCelebrationPayload {
  title: string;
  detail: string;
  kind?: ComposerSendCelebrationKind;
  subject?: string;
  attachmentsCount?: number;
}

const DEFAULT_CELEBRATION_MS = 1800;
const EXIT_LEAD_MS = 240;

export function useComposerSendCelebration(celebrationMs = DEFAULT_CELEBRATION_MS) {
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
      setCelebration(null);
      setIsExiting(false);
      onComplete();
    }, celebrationMs);
  }

  return {
    celebration,
    celebrate,
    isCelebrating: celebration !== null,
    isExiting,
  };
}
