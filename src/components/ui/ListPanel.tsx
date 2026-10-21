import { useEffect, useState, type ReactNode } from "react";
import { ListPanelContext } from "./listPanelContext";
import { TableSelectionBar, type TableSelectionAction, type TableSelectionBarProps } from "./TableSelectionBar";

/**
 * El panel de un listado: barra de criterios, tabla y pie, dentro de UNA sola
 * superficie blanca sobre el lienzo tintado.
 *
 * ------------------------------------------------------------------
 * POR QUÉ LA BARRA VA ADENTRO
 * ------------------------------------------------------------------
 * Antes el buscador, los filtros y el paginador vivían sueltos sobre el fondo,
 * y solo la tabla tenía tarjeta. Eso rompe la relación que el ojo necesita:
 * los criterios no son tres controles decorando la página, son LO QUE GOBIERNA
 * esas filas. Un filtro fuera del panel parece aplicar a la pantalla; dentro
 * del panel se lee, correctamente, como que aplica a esta tabla.
 *
 * La barra de criterios y el pie (paginación o conteo) van FUERA de la tarjeta blanca,
 * sobre el lienzo, igual que en la bandeja de tickets.
 *
 * ------------------------------------------------------------------
 * TRES ZONAS, DOS FILETES
 * ------------------------------------------------------------------
 * Cabecera y pie se separan del cuerpo con un filete, nunca con un tinte de
 * fondo: tintar la cabecera la convertiría en una cuarta superficie discutiendo
 * con la tarjeta y con el lienzo. La jerarquía la hacen el filete y el espacio.
 *
 * `overflow: hidden` es lo que deja que las filas lleguen a sangre sin que las
 * esquinas se desborden del radio.
 */
export function ListPanel({
  toolbar,
  action,
  selection,
  footer,
  children,
  className = "",
}: {
  /** Criterios que gobiernan la tabla: búsqueda, selects, pastillas, columnas. */
  toolbar?: ReactNode;
  /**
   * La acción principal del módulo: «Nuevo cliente», «Nueva HCA», «Nuevo rol».
   *
   * Vivía suelta sobre el lienzo, encima del panel, gastando un renglón entero
   * para no pertenecer a nada — y eso pasaba en nueve pantallas, así que no era
   * un descuido de una sino la forma por defecto. Un botón que crea una fila de
   * ESTA tabla pertenece a ESTA tabla: anclado arriba a la derecha del panel, la
   * relación se lee sin explicarla.
   */
  action?: ReactNode;
  /** Barra de selección en lote que reemplaza animadamente a la barra de criterios. */
  selection?: Omit<TableSelectionBarProps, "isExiting">;
  /** Normalmente `Pagination`, o el conteo cuando el listado no pagina. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const isSelecting = Boolean(selection && selection.count > 0);
  const [prevSelecting, setPrevSelecting] = useState(isSelecting);
  const [selectionExiting, setSelectionExiting] = useState(false);
  const [criteriaExiting, setCriteriaExiting] = useState(false);
  const [preservedCount, setPreservedCount] = useState(0);
  const [preservedActions, setPreservedActions] = useState<TableSelectionAction[]>([]);

  if (isSelecting && selection) {
    if (preservedCount !== selection.count) setPreservedCount(selection.count);
    if (preservedActions !== selection.actions) setPreservedActions(selection.actions);
  }
  if (prevSelecting !== isSelecting) {
    setPrevSelecting(isSelecting);
    setSelectionExiting(!isSelecting);
    setCriteriaExiting(isSelecting);
  }

  useEffect(() => {
    if (!selectionExiting) return;
    const timer = setTimeout(() => setSelectionExiting(false), 180);
    return () => clearTimeout(timer);
  }, [selectionExiting]);

  useEffect(() => {
    if (!criteriaExiting) return;
    const timer = setTimeout(() => setCriteriaExiting(false), 160);
    return () => clearTimeout(timer);
  }, [criteriaExiting]);

  const showSelection = Boolean(selection && (isSelecting || selectionExiting));
  const showCriteria = Boolean((toolbar || action) && (!isSelecting || criteriaExiting));

  return (
    <ListPanelContext.Provider value={true}>
      {(toolbar || action || showSelection) && (
        <div className="mb-3 grid min-h-8">
          {showCriteria && (
            <div
              inert={criteriaExiting ? true : undefined}
              className={`col-start-1 row-start-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${
                criteriaExiting ? "animate-plf-tabs-out" : selection ? "animate-plf-tabs-in" : ""
              }`}
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
              {action && <div className="shrink-0">{action}</div>}
            </div>
          )}

          {showSelection && selection && (
            <div className="col-start-1 row-start-1 w-full" inert={selectionExiting ? true : undefined}>
              <TableSelectionBar
                count={isSelecting ? selection.count : preservedCount}
                pageState={selection.pageState}
                busy={selection.busy}
                isExiting={selectionExiting}
                onTogglePage={selection.onTogglePage}
                onClear={selection.onClear}
                actions={isSelecting ? selection.actions : preservedActions}
              />
            </div>
          )}
        </div>
      )}

      <section
        className={`overflow-hidden rounded-card border border-line bg-white shadow-card ${className}`}
      >
        {/* El scroll horizontal vive acá y no en la tabla: así la cabecera y el
            pie se quedan quietos cuando una tabla ancha se desplaza. */}
        <div className="overflow-x-auto">{children}</div>
      </section>

      {/* El pie va FUERA de la tarjeta, sobre el fondo de la pagina: asi la paginacion se ve igual en todas las vistas. */}
      {footer}
    </ListPanelContext.Provider>
  );
}
