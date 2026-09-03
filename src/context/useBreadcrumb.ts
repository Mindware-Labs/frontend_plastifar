import { createContext, useContext, useEffect } from "react";

/** Deja que una ficha reemplace su ultimo segmento por un nombre real una vez
 *  carga, en vez de mostrar el id o un generico "Colaborador"/"Cliente". */
export const BreadcrumbLabelContext = createContext<((label: string | null) => void) | null>(null);

/**
 * Publica el nombre resuelto de la ficha actual para el ultimo segmento del
 * breadcrumb del TopBar. Se limpia solo al desmontar, para no dejar un
 * nombre viejo puesto cuando la persona navega a otra ficha.
 */
export function useDynamicBreadcrumb(label: string | null) {
  const setLabel = useContext(BreadcrumbLabelContext);

  useEffect(() => {
    setLabel?.(label);
    return () => setLabel?.(null);
  }, [label, setLabel]);
}
