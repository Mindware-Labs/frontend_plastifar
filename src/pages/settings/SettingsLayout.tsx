import type { ReactNode } from "react";
import { ModuleHeader } from "../../components/app/ModuleHeader";

interface SettingsLayoutProps {
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Cabecera compartida de Configuracion. Los siete catalogos se navegan desde
 * el Sidebar (grupo "Configuración"); esta pantalla ya no repite esas rutas
 * como pestanas propias.
 */
export function SettingsLayout({ action, children }: SettingsLayoutProps) {
  return (
    <div>
      <ModuleHeader action={action} />
      {children}
    </div>
  );
}
