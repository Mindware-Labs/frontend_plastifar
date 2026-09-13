import { createContext, useContext } from "react";
import type { DashboardResponse } from "../../api/dashboard";

/**
 * El dato del tablero, para las ocho tarjetas.
 *
 * ------------------------------------------------------------------
 * POR QUE UN CONTEXTO Y NO PROPS
 * ------------------------------------------------------------------
 * Antes cada tarjeta importaba `mockData.ts` por su cuenta. Reemplazar eso por
 * props habria significado que `CXDashboard` acarreara ocho cadenas de datos
 * distintas hasta sus hijos, y que agregar un dato nuevo obligara a tocar la
 * portada ademas de la tarjeta que lo usa.
 *
 * El contexto conserva la propiedad que tenia el modulo de datos —cada tarjeta
 * toma lo suyo, sin intermediarios— y agrega la que faltaba: hay UNA sola
 * lectura, asi que las ocho hablan del mismo instante.
 *
 * Vive en su propio archivo porque mezclar contexto y componentes rompe el
 * refresco rapido de Vite; es el mismo motivo por el que `listPanelContext.ts`
 * esta separado de `ListPanel.tsx`.
 */
export const DashboardContext = createContext<DashboardResponse | null>(null);

/**
 * El dato, garantizado.
 *
 * Lanza si se usa fuera del proveedor en vez de devolver null. Una tarjeta que
 * recibe null pintaria ceros, y un cero en un tablero de operacion es una
 * AFIRMACION —«no hay ninguno vencido»— no un «todavia no se»: exactamente el
 * tipo de dato inventado del que esta pantalla viene saliendo.
 */
export function useDashboard(): DashboardResponse {
  const data = useContext(DashboardContext);
  if (data === null) {
    throw new Error(
      "Esta tarjeta necesita el dato del tablero. Debe montarse dentro de <CXDashboard>.",
    );
  }
  return data;
}

/**
 * Color estable a partir de un identificador.
 *
 * La version anterior indexaba la paleta con `id - 1`, que solo funciona si los
 * identificadores son densos y empiezan en uno. Con identificadores reales
 * —con huecos, y empezando donde empiecen— eso daba indices negativos o
 * repetidos: dos personas del mismo color, o ninguno.
 */
export function colorIndex(id: number, total: number): number {
  return Math.abs(id * 2654435761) % total;
}
