import { useOutletContext } from "react-router-dom";

export interface AppOutletContext {
  search: string;
}

/** Buscador global de la cabecera, accesible desde cualquier pagina del modulo. */
export function useAppSearch() {
  return useOutletContext<AppOutletContext>().search;
}
