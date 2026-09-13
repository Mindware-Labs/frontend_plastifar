import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  PageChromeContext,
  type PageChrome,
  type PageChromeStore,
} from "./pageChromeStore";

/** Guarda lo que la pantalla montada declaró para la barra. */
export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChromeState] = useState<PageChrome>({});
  const [dynamicLabel, setDynamicLabel] = useState<string | null>(null);

  /**
   * `setChrome` tiene que ser ESTABLE, y esa estabilidad no es un detalle de
   * rendimiento: es lo que impide un bucle infinito.
   *
   * `usePageChrome` lleva `setChrome` en las dependencias de su efecto, y el
   * efecto publica un objeto nuevo en cada corrida. Cuando `setChrome` nacía
   * dentro del `useMemo` de abajo, la cadena se cerraba sobre sí misma:
   * publicar cambiaba `chrome` → `chrome` rehacía el `value` → el `value`
   * traía un `setChrome` nuevo → el efecto volvía a correr → publicaba otra
   * vez. React lo cortaba con «Maximum update depth exceeded» y la consola se
   * llenaba en cada navegación y en cada resize.
   *
   * Con la identidad congelada el efecto sólo depende de lo que la pantalla
   * declara de verdad, y el ciclo no existe.
   */
  const setChrome = useCallback(
    (next: PageChrome | null) => setChromeState(next ?? {}),
    [],
  );

  const value = useMemo<PageChromeStore>(
    () => ({ chrome, setChrome, dynamicLabel, setDynamicLabel }),
    [chrome, setChrome, dynamicLabel],
  );

  return <PageChromeContext.Provider value={value}>{children}</PageChromeContext.Provider>;
}
