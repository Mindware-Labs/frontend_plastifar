import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { usePermissions } from "../../hooks/usePermissions";

interface ReportsLayoutProps {
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Cabecera compartida de Reportes. Las siete familias se navegan desde el
 * Sidebar (grupo "Reportes"); esta pantalla ya no repite esas rutas como
 * pestanas propias.
 *
 * La puerta de `reports.read` vive aqui y no en cada seccion: toda pantalla del
 * modulo pasa por este layout, asi que una familia nueva queda protegida sin
 * acordarse de nada. Esto no sustituye a la guarda de ruta en App.tsx ni al
 * rechazo del endpoint; solo evita pintar cifras a quien no debe verlas.
 */
export function ReportsLayout({ action, children }: ReportsLayoutProps) {
  const { can } = usePermissions();

  if (!can("reports.read")) {
    return (
      <div>
        <ModuleHeader />
        <div className="flex items-start gap-2.5 py-8">
          <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
          <p className="max-w-[76ch] text-[13.5px] leading-relaxed text-muted">
            No tienes el permiso <span className="font-mono text-[10.5px] text-faint">reports.read</span>,
            necesario para consultar los reportes. Pídelo al administrador del panel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ModuleHeader action={action} />
      {children}
    </div>
  );
}
