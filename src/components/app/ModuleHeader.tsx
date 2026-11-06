import { ArrowLeft } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { SegmentedTabs, type SegmentedTabItem } from "../ui/SegmentedTabs";

/** Alinea bloques bajo el header con el título cuando hay botón volver (32px + gap-x-3). */
export const MODULE_HEADER_TITLE_GUTTER_CLASS = "pl-11";

/** Misma franja horizontal: eje del PLT-… a la izquierda y borde del layout a la derecha. */
export const MODULE_HEADER_CONTENT_BAND_CLASS = "pl-11 pr-3 lg:pr-4";

/** Igual offset a ambos lados del lienzo (fichas de cliente). */
export const MODULE_HEADER_SYMMETRIC_BAND_CLASS = "pl-11 pr-11";

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
  /** Accion principal de la pagina. */
  action?: ReactNode;
}

export function ModuleHeader({
  backTo,
  backLabel,
  title,
  badge,
  summary,
  sections,
  action,
}: ModuleHeaderProps) {
  const hasHeading = title !== undefined || summary !== undefined || backTo !== undefined;
  const location = useLocation();

  const sectionItems: SegmentedTabItem[] | null = useMemo(() => {
    if (!sections?.length) return null;
    return sections.map((section, idx) => ({
      key: section.to ?? `section-${idx}`,
      label: section.label,
      to: section.to,
      end: section.end,
      onClick: section.onClick,
    }));
  }, [sections]);

  const activeSectionKey = useMemo(() => {
    if (!sections?.length) return null;
    let routeKey: string | null = null;
    for (const section of sections) {
      if (!section.to) continue;
      const end = section.end ?? true;
      const matches = end
        ? location.pathname === section.to
        : location.pathname === section.to || location.pathname.startsWith(`${section.to}/`);
      if (!matches) continue;
      if (!routeKey || section.to.length > routeKey.length) routeKey = section.to;
    }
    if (routeKey) return routeKey;
    const activeIdx = sections.findIndex((section) => !section.to && section.active);
    if (activeIdx >= 0) return `section-${activeIdx}`;
    return null;
  }, [sections, location.pathname]);

  return (
    <div className="shrink-0 border-b border-zinc-200/80 -mx-3 lg:-mx-4 px-3 lg:px-4 mb-3 h-14">
      <div className="flex h-full items-center justify-between gap-x-4">
        {hasHeading ? (
          <div className="flex shrink-0 items-center gap-x-3">
            {backTo ? (
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
          {sectionItems && sectionItems.length > 0 && (
            <SegmentedTabs
              items={sectionItems}
              activeKey={activeSectionKey}
              ariaLabel="Secciones de la ficha"
            />
          )}

          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </div>
      </div>
    </div>
  );
}
