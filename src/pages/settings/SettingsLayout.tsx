import type { ReactNode } from "react";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Badge } from "../../components/ui/Badge";

interface SettingsLayoutProps {
  /** Resumen en linea con el titulo; cada seccion cuenta lo suyo. */
  summary: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Cabecera compartida de Configuracion. Los siete catalogos se navegan desde
 * el Sidebar (grupo "Configuración"); esta pantalla ya no repite esas rutas
 * como pestanas propias.
 */
export function SettingsLayout({ summary, action, children }: SettingsLayoutProps) {
  return (
    <div>
      <ModuleHeader
        title="Configuración"
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
