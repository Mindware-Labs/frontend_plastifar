import { ChevronLeft } from "lucide-react";
import { NavLink, Link } from "react-router-dom";
import type { ReactNode } from "react";

export interface ModuleSection {
  label: string;
  to: string;
}

const defaultSections: ModuleSection[] = [
  { label: "Colaboradores", to: "/staff" },
  { label: "Roles", to: "/roles" },
  { label: "Permisos", to: "/permisos" },
];

interface ModuleHeaderProps {
  /** Titulo del modulo. Las fichas lo sustituyen por el nombre del registro. */
  title?: string;
  /** Resumen en linea con el titulo, no debajo: gana altura para la tabla. */
  summary?: ReactNode;
  /** Accion principal del modulo, alineada con las pestanas de seccion. */
  action?: ReactNode;
  /**
   * Pestanas de seccion. Una ficha pasa las suyas, que navegan dentro del
   * registro en lugar de salir del modulo.
   */
  sections?: ModuleSection[];
  /** Ruta de vuelta al listado. Presente solo en fichas. */
  backTo?: { to: string; label: string };
}

export function ModuleHeader({
  title = "Personal",
  summary,
  action,
  sections = defaultSections,
  backTo,
}: ModuleHeaderProps) {
  return (
    <div className="mb-3">
      {backTo && (
        <Link
          to={backTo.to}
          className="-ml-1 mb-1.5 inline-flex items-center gap-1 rounded-edge px-1 py-0.5 text-[12px] font-medium
            text-muted transition-colors hover:text-ink"
        >
          <ChevronLeft aria-hidden className="h-3.5 w-3.5" />
          {backTo.label}
        </Link>
      )}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-heading text-[20px] font-bold tracking-[-0.02em] text-ink">{title}</h1>
        {/* El filete y el resumen van en un solo bloque: sueltos como hermanos
            del flex, al envolverse la linea el filete se quedaba colgando solo
            al final del titulo. */}
        {summary && (
          <span className="flex items-center gap-3">
            <span aria-hidden className="hidden h-3.5 w-px bg-line sm:block" />
            <span className="text-[12.5px] text-muted">{summary}</span>
          </span>
        )}
      </div>

      {/* Las pestanas se desplazan dentro de su propia franja y la accion baja de
          linea si no cabe: con cinco secciones, un flex rigido empujaba el boton
          fuera del viewport y hacia desbordar la pagina entera en 390 px. */}
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-line">
        <div className="flex w-full min-w-0 items-center gap-6 overflow-x-auto pb-px sm:w-auto sm:flex-1">
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
        </div>

        {action && <div className="shrink-0 pb-1.5">{action}</div>}
      </div>
    </div>
  );
}
