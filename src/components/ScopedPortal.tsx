import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePortalHost } from "../lib/portalHost";

interface ScopedPortalProps {
  children?: ReactNode;
  container: Element | DocumentFragment;
  portalKey?: string | null;
}

/** Portal que, si apuntaba a document.body, monta en el contenedor de su vista viva para ocultarse con ella. */
export function ScopedPortal({ children, container, portalKey }: ScopedPortalProps) {
  const host = usePortalHost();
  return createPortal(children, container === document.body ? host : container, portalKey);
}
