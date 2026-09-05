import type { ReactNode } from "react";

/**
 * Encabezado de bloque dentro de un reporte. Va en el escalon Label de la
 * rampa (Montserrat 600, 10px, versalitas) porque es exactamente eso, un
 * rotulo de grupo: entre Body 13.5 y Title 17 no hay escalon y estos titulos
 * se habian inventado uno.
 */
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
      {children}
    </h2>
  );
}
