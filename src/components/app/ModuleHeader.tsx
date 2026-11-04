import { ArrowLeft } from "lucide-react";
import { useMemo, useRef, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useModuleHeaderSectionIndicator } from "../../hooks/useModuleHeaderSectionIndicator";

/** Alinea bloques bajo el header con el título cuando hay botón volver (32px + gap-x-3). */
export const MODULE_HEADER_TITLE_GUTTER_CLASS = "pl-11";

/** Misma franja horizontal: eje del PLT-… a la izquierda y borde del layout a la derecha. */
export const MODULE_HEADER_CONTENT_BAND_CLASS = "pl-11 pr-3 lg:pr-4";

export interface ModuleHeaderSection {
  label: ReactNode;
  to?: string;
  /** Igual que NavLink `end` (p. ej. /tickets sin absorber /tickets/historico). */
  end?: boolean;
  active?: boolean;
  onClick?: () => void;
}

interface ModuleHeaderProps {
  /** Enlace opcional para volver atrás (p. ej. a la tabla o listado principal). */
  backTo?: string;
  /** Acción de retorno opcional (en vez de un enlace de navegación). */
  onBack?: () => void;
  /** Texto del tooltip y aria-label del botón volver. */
  backLabel?: string;
  /** Titulo de la pagina. */
  title?: ReactNode;
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
  backTo,
  onBack,
  backLabel,
  title,
  badge,
  summary,
  sections,
  note,
  action,
  className = "",
}: ModuleHeaderProps) {
  const hasHeading = title !== undefined || summary !== undefined || backTo !== undefined || onBack !== undefined;
  const location = useLocation();
  const sectionsNavRef = useRef<HTMLElement>(null);

  const activeSectionKey = useMemo(() => {
    if (!sections?.length) return null;
    let best: string | null = null;
    for (const section of sections) {
      if (!section.to) continue;
      const end = section.end ?? true;
      const matches = end
        ? location.pathname === section.to
        : location.pathname === section.to || location.pathname.startsWith(`${section.to}/`);
      if (!matches) continue;
      if (!best || section.to.length > best.length) best = section.to;
    }
    return best;
  }, [sections, location.pathname]);

  const { rect: sectionIndicator, motion: sectionIndicatorMotion } = useModuleHeaderSectionIndicator(
    sectionsNavRef,
    activeSectionKey,
  );

  const sectionIndicatorMotionClass =
    sectionIndicatorMotion === "travel"
      ? "transition-[left,width] duration-[320ms] ease-plf-spring motion-reduce:transition-none"
      : "transition-none";

  return (
    <div
      className={`shrink-0 border-b border-zinc-200/80 -mx-3 lg:-mx-4 px-3 lg:px-4 mb-3 ${
        note ? "min-h-14 py-2" : "h-14"
      } ${className}`}
    >
      <div className="flex h-full items-center justify-between gap-x-4">
        {hasHeading ? (
          <div className="flex shrink-0 items-center gap-x-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                title={backLabel ?? "Volver"}
                aria-label={backLabel ?? "Volver"}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-2.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50 transition-all shadow-2xs shrink-0 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                {backLabel && <span>{backLabel}</span>}
              </button>
            ) : backTo ? (
              <Link
                to={backTo}
                title={backLabel ?? "Volver"}
                aria-label={backLabel ?? "Volver"}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200/90 bg-white text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50 transition-all shadow-2xs shrink-0 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            ) : null}
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
                <div className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                  {summary}
                </div>
              </>
            )}
          </div>
        ) : null}

        <div className="flex h-full items-center gap-3">
          {sections && sections.length > 0 && (
            <nav
              ref={sectionsNavRef}
              aria-label="Secciones de la ficha"
              className="relative flex h-full items-center gap-1 self-stretch"
            >
              <span
                aria-hidden
                className={`pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-brand-red ${sectionIndicatorMotionClass}`}
                style={{
                  left: sectionIndicator.left,
                  width: sectionIndicator.width,
                  opacity: sectionIndicator.visible ? 1 : 0,
                }}
              />
              {sections.map((section, idx) => {
                const navClass = (isActive: boolean) =>
                  `flex h-full items-center border-b-2 border-transparent px-2.5 text-[12.5px] font-medium transition-[color] duration-200 ease-out -mb-px whitespace-nowrap cursor-pointer select-none ` +
                  (isActive
                    ? "text-zinc-900 font-semibold"
                    : "text-zinc-500 hover:text-zinc-900");

                if (section.to) {
                  return (
                    <NavLink
                      key={section.to}
                      to={section.to}
                      end={section.end ?? true}
                      className={({ isActive }) => navClass(isActive)}
                    >
                      {section.label}
                    </NavLink>
                  );
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={section.onClick}
                    className={`${navClass(Boolean(section.active))} bg-transparent border-t-0 border-x-0 outline-none`}
                  >
                    {section.label}
                  </button>
                );
              })}
            </nav>
          )}

          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </div>
      </div>

      {note && (
        <p className="mt-1 max-w-[72ch] text-[12.5px] leading-relaxed text-subtle">{note}</p>
      )}
    </div>
  );
}
