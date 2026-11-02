import { useMemo } from "react";
import {
  APPLE_LIST_ENTER_MS,
  APPLE_LIST_EXIT_MS,
  useAppleListMotion,
} from "../../hooks/useAppleListMotion";

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
    enterMs: APPLE_LIST_ENTER_MS,
    exitMs: APPLE_LIST_EXIT_MS,
  });
}
