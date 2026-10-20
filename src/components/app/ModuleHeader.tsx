import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

interface ModuleHeaderSection {
  label: string;
  to: string;
}

interface ModuleHeaderProps {
  /** Titulo de la pagina. */
  title?: string;
  /** Badge opcional junto al titulo (p. ej. contador o tag). */
  badge?: ReactNode;
  /** Resumen en linea con el titulo, no debajo: gana altura para el contenido. */
  summary?: ReactNode;
  /**
   * Rutas hermanas dentro de una misma ficha (Datos, Accesos, Contactos).
   * No son rutas del Sidebar —viven bajo un :id— asi que necesitan su propia
   * tira; el resto de la navegacion no se duplica aqui.
   */
  sections?: ModuleHeaderSection[];
  /**
   * La regla que gobierna la pantalla, en su propia linea bajo el titulo.
   */
  note?: ReactNode;
  /** Accion principal de la pagina. */
  action?: ReactNode;
  className?: string;
}

export function ModuleHeader({
  title,
  badge,
  summary,
  sections,
  note,
  action,
  className = "",
}: ModuleHeaderProps) {
  const hasHeading = title !== undefined || summary !== undefined;

  return (
    <div
      className={`shrink-0 border-b border-zinc-200/80 -mx-3 lg:-mx-4 px-3 lg:px-4 mb-3 ${
        note ? "min-h-14 py-2" : "h-14"
      } ${className}`}
    >
      <div className="flex h-full flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {hasHeading ? (
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
            {title && (
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-[20px] font-bold leading-none tracking-[-0.02em] text-zinc-900">
                  {title}
                </h1>
                {badge}
              </div>
            )}
            {summary && (
              <>
                {title && <span aria-hidden className="hidden h-4 w-px bg-zinc-200/90 sm:inline-block" />}
                {/* Un <div> y no un <p>: `summary` es un ReactNode y hay pantallas que
                    le pasan una fila de contadores, es decir un <div>. */}
                <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-zinc-500">
                  {summary}
                </div>
              </>
            )}
          </div>
        ) : null}

        <div className="flex h-full flex-wrap items-center gap-3">
          {sections && sections.length > 0 && (
            <nav aria-label="Secciones de la ficha" className="flex h-full items-center gap-1 self-stretch">
              {sections.map((section) => (
                <NavLink
                  key={section.to}
                  to={section.to}
                  end
                  className={({ isActive }) =>
                    `flex h-full items-center border-b-2 px-2.5 text-[12.5px] font-medium transition-colors -mb-px ` +
                    (isActive
                      ? "border-brand-red text-ink font-semibold"
                      : "border-transparent text-subtle hover:text-ink")
                  }
                >
                  {section.label}
                </NavLink>
              ))}
            </nav>
          )}

          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      </div>

      {note && (
        <p className="mt-1 max-w-[72ch] text-[12.5px] leading-relaxed text-subtle">{note}</p>
      )}
    </div>
  );
}
