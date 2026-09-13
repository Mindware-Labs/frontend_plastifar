import type { ReactNode } from "react";
import { ListPanelContext } from "./listPanelContext";

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
 * Además cierra la figura. Con la barra y el pie afuera, la tarjeta empezaba y
 * terminaba en cortes arbitrarios; acá el panel abre con sus criterios y cierra
 * con su conteo, que es la misma anatomía de la referencia.
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
  /** Normalmente `Pagination`, o el conteo cuando el listado no pagina. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ListPanelContext.Provider value={true}>
      <section
        className={`overflow-hidden rounded-card border border-line bg-white shadow-card ${className}`}
      >
        {(toolbar || action) && (
          <div className="flex items-start gap-3 border-b border-line px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
        )}

        {/* El scroll horizontal vive acá y no en la tabla: así la cabecera y el
            pie se quedan quietos cuando una tabla ancha se desplaza. */}
        <div className="overflow-x-auto">{children}</div>

        {footer && <div className="border-t border-line px-4">{footer}</div>}
      </section>
    </ListPanelContext.Provider>
  );
}
