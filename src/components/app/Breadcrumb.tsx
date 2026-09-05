import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Crumb } from "../../lib/breadcrumbs";

interface BreadcrumbProps {
  crumbs: Crumb[];
}

/**
 * Unico lugar del panel donde vive "donde estoy": el App Shell, nunca dentro
 * de una vista. Cada modulo/pagina solo aporta su propio contenido — ver
 * DESIGN.md, seccion App Shell.
 */
export function Breadcrumb({ crumbs }: BreadcrumbProps) {
  if (crumbs.length === 0) return null;

  const current = crumbs[crumbs.length - 1];
  const ancestors = crumbs.slice(0, -1);

  return (
    <>
      {/* Encabezado de primer nivel del panel. Es invisible a proposito: el
          dispositivo visible que nombra la pagina es el rastro de abajo (ver
          DESIGN.md, App Shell), pero sin un <h1> cada pantalla del panel
          entregaba un esquema de documento vacio a un lector de pantalla. */}
      <h1 className="sr-only">{current.label}</h1>

      <nav aria-label="Ubicación actual" className="flex min-w-0 items-center">
      {/* Movil: solo la pagina actual — el resto del rastro compite por muy
          poco ancho y el Sidebar ya resuelve "a donde puedo ir". */}
      <span className="truncate text-[13px] font-semibold text-ink sm:hidden">{current.label}</span>

      {/* Escritorio: rastro completo, los niveles anteriores discretos y
          enlazables, el actual con mas peso. */}
      <ol className="hidden min-w-0 items-center gap-1.5 sm:flex">
        {ancestors.map((crumb) => (
          <li key={crumb.label} className="flex shrink-0 items-center gap-1.5">
            {crumb.to ? (
              <Link
                to={crumb.to}
                className="whitespace-nowrap rounded-edge text-[13px] font-medium text-muted
                  outline-none transition-colors hover:text-ink focus-visible:ring-3
                  focus-visible:ring-brand-red/25"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="whitespace-nowrap text-[13px] font-medium text-muted">{crumb.label}</span>
            )}
            <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-line-strong" />
          </li>
        ))}
        <li className="min-w-0 truncate text-[13px] font-semibold text-ink" aria-current="page">
          {current.label}
        </li>
        </ol>
      </nav>
    </>
  );
}
