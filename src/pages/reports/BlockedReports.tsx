import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import type { ReportDefinition } from "../../types/reports";

interface BlockedReportsProps {
  /** Por que no se pueden calcular todavia. */
  note: ReactNode;
  reports: ReportDefinition[];
}

/**
 * Unica presentacion de "este reporte todavia no se puede calcular", igual en
 * el catalogo de una familia bloqueada que en el bloque final de Calidad y
 * Clientes: un mismo hecho no puede verse de tres maneras.
 *
 * Sin boton. Un "Vista previa pendiente" deshabilitado no dice nada que la
 * nota de arriba no diga ya, y un boton que finge funcionar es peor que
 * ninguno. Filetes en vez de recuadros: esto no es el Dashboard.
 */
export function BlockedReports({ note, reports }: BlockedReportsProps) {
  return (
    <div>
      <div className="mb-1 flex items-start gap-2.5 py-2">
        <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
        <p className="max-w-[76ch] text-[12.5px] leading-relaxed text-muted">{note}</p>
      </div>

      <ul className="border-t border-line-soft">
        {reports.map((report) => (
          <li
            key={report.id}
            className="flex flex-col gap-1 border-b border-line-soft py-2.5 sm:flex-row sm:items-baseline sm:gap-4"
          >
            <span className="text-[13px] font-medium leading-tight text-ink sm:w-[280px] sm:shrink-0">
              {report.name}
            </span>
            <span className="text-[12px] leading-relaxed text-faint">{report.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
