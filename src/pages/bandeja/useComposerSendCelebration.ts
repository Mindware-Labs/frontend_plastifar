import { useEffect, useRef, useState } from "react";

export interface ComposerSendCelebrationPayload {
  title: string;
  detail: string;
}

const DEFAULT_CELEBRATION_MS = 1750;

export function useComposerSendCelebration(celebrationMs = DEFAULT_CELEBRATION_MS) {
  const [celebration, setCelebration] = useState<ComposerSendCelebrationPayload | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  function celebrate(payload: ComposerSendCelebrationPayload, onComplete: () => void) {
    setCelebration(payload);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setCelebration(null);
      onComplete();
    }, celebrationMs);
  }

  return {
    celebration,
    celebrate,
    isCelebrating: celebration !== null,
  };
}
