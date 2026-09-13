import { createContext, useContext } from "react";

/**
 * Densidad vertical de una tabla.
 *
 * ------------------------------------------------------------------
 * POR QUE ES UNA OPCION Y NO UN CAMBIO GLOBAL
 * ------------------------------------------------------------------
 * `Td` y `Th` los comparten las catorce tablas del panel, y apretar el relleno
 * ahi habria cambiado las catorce para resolver el problema de una. La bandeja
 * es la unica que tiene que mostrar diez renglones completos sin que la ultima
 * fila quede debajo del pliegue; un catalogo de seis territorios no gana nada
 * con celdas mas apretadas y pierde legibilidad.
 *
 * ------------------------------------------------------------------
 * EL PRECIO, DICHO
 * ------------------------------------------------------------------
 * `compacta` no esconde ningun dato: quita aire. Menos relleno y menos
 * interlineado en las celdas de dos lineas. Es aire que en la bandeja se paga
 * con una fila que no se ve, y en un catalogo corto no se paga con nada, que es
 * justo por lo que no se aplica de oficio.
 */
export type TableDensity = "comoda" | "compacta";

export const DataTableDensityContext = createContext<TableDensity>("comoda");

export function useTableDensity(): TableDensity {
  return useContext(DataTableDensityContext);
}
