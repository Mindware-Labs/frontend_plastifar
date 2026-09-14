import type { RefObject } from "react";

interface RelayRingProps {
  ringRef: RefObject<HTMLSpanElement | null>;
  /** Posición y radio respecto al contenedor relativo que lo aloja. */
  className?: string;
}

/** Anillo que viaja en el relevo del foco. Invisible salvo mientras dura el viaje. */
export function RelayRing({ ringRef, className = "-inset-px rounded-lg" }: RelayRingProps) {
  return (
    <span
      ref={ringRef}
      aria-hidden
      className={`pointer-events-none absolute border border-brand-red opacity-0 ring-3 ring-brand-red/10 ${className}`}
    />
  );
}
