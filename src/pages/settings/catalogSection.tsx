import type { ReactNode } from "react";

/**
 * Piezas comunes a los catálogos de Configuración.
 * Avisos y errores de página van por recibos (useNoticeReceipts), no banners incrustados.
 */

/** Grupo de pastillas con nombre accesible: sueltas no dicen que filtran. */
export function ChipGroup({
  label,
  ready = true,
  skeletonCount = 3,
  children,
}: {
  label: string;
  ready?: boolean;
  skeletonCount?: number;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {ready
        ? children
        : Array.from({ length: skeletonCount }, (_, index) => (
            <span key={index} aria-hidden className="h-8 w-[104px] animate-pulse rounded-full bg-fill" />
          ))}
    </div>
  );
}
