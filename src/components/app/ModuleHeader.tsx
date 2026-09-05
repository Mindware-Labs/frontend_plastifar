import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

export interface ModuleSection {
  label: string;
  to: string;
}

interface ModuleHeaderProps {
  /** Accion principal del modulo. */
  action?: ReactNode;
  /**
   * Pestanas de seccion. Ya NO se usan para navegar entre modulos ni entre
   * los catalogos de un modulo — eso vive en el Sidebar. Esto queda solo
   * para lo que el Sidebar no puede resolver: la navegacion dentro de un
   * registro concreto (la ficha de un colaborador o de un cliente), donde
   * la ruta lleva un id y no tiene sentido como entrada estatica del menu.
   * Volver al listado lo resuelve el breadcrumb del TopBar, no esta cabecera.
   */
  sections?: ModuleSection[];
}

/**
 * El titulo y el resumen del modulo ya no viven aqui: el breadcrumb del
 * TopBar nombra la pagina actual, y repetirlo en el contenido era el mismo
 * dato dos veces. Lo que queda es lo que el breadcrumb no resuelve: la accion
 * principal y, en una ficha, las pestanas de seccion — mas el filete que
 * separa la cabecera de la fila de criterios.
 */
export function ModuleHeader({ action, sections = [] }: ModuleHeaderProps) {
  if (sections.length > 0) {
    return (
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-line">
        {/* Enlaces, no la pauta ARIA de pestanas: cada seccion es una ruta
            propia y NavLink ya marca la activa con aria-current="page". El
            patron tabs prometeria recorrido con flechas que aqui no aplica. */}
        <nav
          aria-label="Secciones"
          className="flex w-full min-w-0 items-center gap-6 overflow-x-auto pb-px sm:w-auto sm:flex-1"
        >
          {sections.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `-mb-px shrink-0 whitespace-nowrap border-b-2 pb-2 text-[13px] transition-colors ${
                  isActive
                    ? "border-brand-red font-semibold text-ink"
                    : "border-transparent font-medium text-muted hover:text-ink"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {action && <div className="shrink-0 pb-1.5">{action}</div>}
      </div>
    );
  }

  if (action) {
    return <div className="mb-3 flex justify-end border-b border-line pb-3">{action}</div>;
  }

  return <div className="mb-3 border-b border-line" />;
}
