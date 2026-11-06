import { createElement, type ReactNode } from "react";
import { ScopedPortal } from "../components/ScopedPortal";

/** Igual que createPortal de react-dom, pero lo que iba a document.body se oculta junto con su vista viva. */
export function createPortal(children: ReactNode, container: Element | DocumentFragment, key?: string | null) {
  return createElement(ScopedPortal, { container, portalKey: key }, children);
}
