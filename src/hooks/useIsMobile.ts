// Puerto de useIsMobile.ts —
// https://github.com/Subhan-code/Amicro--Micro-transitions- (MIT).
import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Detecta el ancho de pantalla movil para apagar las animaciones pesadas.
 *
 * Es una suscripcion a algo externo al arbol, que es justo lo que
 * `useSyncExternalStore` existe para leer. La version anterior mantenia el
 * valor en `useState` con un inicializador y ademas lo reescribia dentro de un
 * `useEffect`, lo que producia dos problemas: un render extra en cada montaje,
 * y dos fuentes de verdad que no coincidian exactamente en `breakpoint` px
 * -el inicializador combinaba `innerWidth < breakpoint` con la media query, y
 * las dos discrepan en el limite-. Aqui la media query es la unica fuente.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const query = useMemo(
    () => (typeof window === "undefined" ? null : window.matchMedia(`(max-width: ${breakpoint}px)`)),
    [breakpoint],
  );

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (query === null) return () => {};
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => query?.matches ?? false,
    () => false,
  );
}
