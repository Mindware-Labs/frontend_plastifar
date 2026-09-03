import type { ReactNode } from "react";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Badge } from "../../components/ui/Badge";

const sections = [
  { label: "Motivos", to: "/configuracion/motivos" },
  { label: "SLA", to: "/configuracion/sla" },
  { label: "Días no laborables", to: "/configuracion/feriados" },
  { label: "Líneas de producto", to: "/configuracion/lineas" },
  { label: "Plantillas", to: "/configuracion/plantillas" },
  { label: "Buzones", to: "/configuracion/buzones" },
];

interface SettingsLayoutProps {
  /** Resumen en linea con el titulo; cada seccion cuenta lo suyo. */
  summary: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Cabecera compartida de Configuracion. Las cinco secciones son pestanas de una
 * sola pantalla: son catalogos distintos pero se administran del mismo modo, y
 * separarlos en modulos haria buscar en cinco sitios lo que se cambia junto.
 */
export function SettingsLayout({ summary, action, children }: SettingsLayoutProps) {
  return (
    <div>
      <ModuleHeader
        title="Configuración"
        sections={sections}
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
