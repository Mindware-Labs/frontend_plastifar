import type { ReactNode } from "react";
import { ModuleHeader } from "../../components/app/ModuleHeader";

interface ReportsLayoutProps {
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Cabecera compartida de Reportes. Las siete familias se navegan desde el
 * Sidebar (grupo "Reportes"); esta pantalla ya no repite esas rutas como
 * pestanas propias.
 */
export function ReportsLayout({ action, children }: ReportsLayoutProps) {
  return (
    <div>
      <ModuleHeader action={action} />
      {children}
    </div>
  );
}
