import { createContext, useContext } from "react";

/**
 * Marca que hay un `ListPanel` alrededor.
 *
 * Lo lee `DataTable` para decidir si dibuja su propia tarjeta o no. Sin esto,
 * una tabla dentro de un panel pintaría una segunda superficie blanca sobre la
 * primera: dos bordes, dos sombras y dos radios discutiendo por el mismo canto.
 *
 * Va en su propio archivo y no dentro de `ListPanel.tsx` porque un módulo que
 * exporta un componente y además un contexto rompe el refresco rápido de Vite,
 * que es la misma razón por la que `pageChromeStore` vive aparte de su
 * proveedor.
 */
export const ListPanelContext = createContext(false);

/** `true` cuando el componente se está renderizando dentro de un `ListPanel`. */
export function useInListPanel(): boolean {
  return useContext(ListPanelContext);
}
