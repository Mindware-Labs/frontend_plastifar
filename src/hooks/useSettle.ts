import { useCallback, useEffect, useState } from "react";

export const SETTLE_MS = 340;

/** Control de micro-animación de asentamiento tras confirmación. */
export function useSettle(durationMs = SETTLE_MS): [boolean, () => void] {
  const [settle, setSettle] = useState(false);

  useEffect(() => {
    if (!settle) return;
    const timer = window.setTimeout(() => setSettle(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [settle, durationMs]);

  const trigger = useCallback(() => setSettle(true), []);

  return [settle, trigger];
}
