import { createContext, useContext } from "react";

// Contenedor de los portales de la vista viva actual; fuera de ellas es null y los portales van a document.body.
export const PortalHostContext = createContext<HTMLElement | null>(null);

/** Donde montar un portal: el contenedor de la vista (se oculta con ella) o document.body. */
export function usePortalHost(): HTMLElement {
  return useContext(PortalHostContext) ?? document.body;
}
