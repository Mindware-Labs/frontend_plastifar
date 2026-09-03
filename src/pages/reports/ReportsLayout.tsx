import type { ReactNode } from "react";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Badge } from "../../components/ui/Badge";
import { REPORT_FAMILIES } from "../../types/reports";

interface ReportsLayoutProps {
  summary: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Cabecera compartida de Reportes. Las siete familias son pestanas de una sola
 * pantalla, igual que Configuracion: son reportes distintos pero comparten
 * rango de fechas, exportacion y alcance por departamento.
 */
export function ReportsLayout({ summary, action, children }: ReportsLayoutProps) {
  return (
    <div>
      <ModuleHeader
        title="Reportes"
        sections={REPORT_FAMILIES.map(({ label, to }) => ({ label, to }))}
        action={action}
        summary={
          <span className="inline-flex flex-wrap items-center gap-2">
            {summary}
            <span aria-hidden className="hidden h-3 w-px bg-line sm:block" />
            <Badge>Datos de demostración</Badge>
          </span>
        }
      />
      {children}
    </div>
  );
}
