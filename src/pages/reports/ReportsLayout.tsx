import type { ReactNode } from "react";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Badge } from "../../components/ui/Badge";

interface ReportsLayoutProps {
  summary: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Cabecera compartida de Reportes. Las siete familias se navegan desde el
 * Sidebar (grupo "Reportes"); esta pantalla ya no repite esas rutas como
 * pestanas propias.
 */
export function ReportsLayout({ summary, action, children }: ReportsLayoutProps) {
  return (
    <div>
      <ModuleHeader
        title="Reportes"
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
