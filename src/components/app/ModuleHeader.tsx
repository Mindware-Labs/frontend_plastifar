import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

interface ModuleHeaderSection {
  label: string;
  to: string;
}

interface ModuleHeaderProps {
  /**
   * Titulo de la pagina. Opcional: en casi todo el panel el nombre del modulo
   * ya lo dice el grupo activo del Sidebar, y repetirlo aqui gastaba una linea
   * para no aportar nada. Se pasa solo donde el encabezado nombra algo que la
   * navegacion no nombra.
   */
  title?: string;
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
   *
   * Distinta de `summary`, que va en la misma linea y solo aguanta una cifra o
   * un estado. Esto es una o dos frases: por que existe este catalogo y que
   * pasa con lo que se guarda aqui. Vivia al pie de cada pantalla, despues de
   * la tabla y de la paginacion —el sitio donde no se lee— y describia
   * justamente lo que hay que saber antes de tocar nada.
   */
  note?: ReactNode;
  /** Accion principal de la pagina. */
  action?: ReactNode;
}

export function ModuleHeader({ title, summary, sections, note, action }: ModuleHeaderProps) {
  const hasHeading = title !== undefined || summary !== undefined;

  return (
    <div className="mb-4 border-b border-line pb-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      {hasHeading ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {title && (
            <h1 className="font-heading text-[20px] font-bold tracking-[-0.02em] text-ink">
              {title}
            </h1>
          )}
          {summary && (
            <>
              {title && <span aria-hidden className="h-3.5 w-px self-center bg-line" />}
              <p className="text-[12.5px] text-subtle">{summary}</p>
            </>
          )}
        </div>
      ) : null}

      {sections && sections.length > 0 && (
        // -pb-3 del contenedor: la barra del activo se apoya sobre el mismo
        // filete que cierra el encabezado, no flota encima de el.
        <nav aria-label="Secciones de la ficha" className="-mb-3 flex items-center gap-1">
          {sections.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              end
              className={({ isActive }) =>
                `border-b-2 px-2.5 pb-2.5 text-[12.5px] font-medium transition-colors ` +
                (isActive
                  ? "border-brand-red text-ink"
                  : "border-transparent text-subtle hover:text-ink")
              }
            >
              {section.label}
            </NavLink>
          ))}
        </nav>
      )}

      {action}
      </div>

      {/* Medida de lectura acotada: la regla es prosa, y a todo el ancho del
          panel se vuelve una linea de 160 caracteres que nadie sigue. */}
      {note && (
        <p className="mt-2 max-w-[72ch] text-[12.5px] leading-relaxed text-subtle">{note}</p>
      )}
    </div>
  );
}
