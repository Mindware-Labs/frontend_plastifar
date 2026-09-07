import type { ReactNode } from "react";
import { ModuleHeader } from "../../components/app/ModuleHeader";

interface SettingsLayoutProps {
  /** Qué catálogo es. */
  title: string;
  /**
   * La regla que gobierna el catálogo: por qué existe y qué pasa con lo que se
   * guarda aquí.
   */
  note: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Cabecera compartida de Configuracion. Los siete catalogos se navegan desde
 * el Sidebar (grupo "Configuración"); esta pantalla ya no repite esas rutas
 * como pestanas propias.
 *
 * Antes no pintaba titulo: el lienzo abria con el boton de "Nuevo …" flotando
 * solo sobre un filete vacio, y lo unico que decia en que catalogo estabas era
 * el resaltado del menu. Siete pantallas casi identicas y ninguna se nombraba.
 *
 * La regla de cada catalogo tambien vivia al final del archivo, debajo de la
 * tabla y de la paginacion. Ahi describe —despues de que ya tocaste algo— lo
 * que habia que saber antes de tocarlo. Ahora encabeza.
 */
export function SettingsLayout({ title, note, action, children }: SettingsLayoutProps) {
  return (
    <div>
      <ModuleHeader title={title} note={note} action={action} />
      {children}
    </div>
  );
}
