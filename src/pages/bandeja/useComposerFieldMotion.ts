import { useMemo } from "react";
import { useAppleListMotion } from "../../hooks/useAppleListMotion";

/** Deben coincidir con plf-composer-row-in / plf-composer-row-out en index.css. */
export const COMPOSER_FIELD_ENTER_MS = 480;
export const COMPOSER_FIELD_EXIT_MS = 480;

export const COMPOSER_CC_KEY = "cc";
export const COMPOSER_BCC_KEY = "bcc";

/** Entrada/salida elástica de filas CC y CCO (misma gramática que líneas PF-FOR). */
export function useComposerFieldMotion(ccOpen: boolean, bccOpen: boolean) {
  const keys = useMemo(() => {
    const next: string[] = [];
    if (ccOpen) next.push(COMPOSER_CC_KEY);
    if (bccOpen) next.push(COMPOSER_BCC_KEY);
    return next;
  }, [ccOpen, bccOpen]);

  return useAppleListMotion(keys, {
    minItems: 0,
    enterMs: COMPOSER_FIELD_ENTER_MS,
    exitMs: COMPOSER_FIELD_EXIT_MS,
  });
}
