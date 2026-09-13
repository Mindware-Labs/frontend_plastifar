import { createContext, type ReactNode, type RefObject } from "react";
import type { Crumb } from "../lib/breadcrumbs";

/**
 * Chrome de página.
 *
 * La página declara qué va en la barra; el layout lo pinta. Nada sube por
 * props, nada se duplica, y una pantalla que no declara nada obtiene una barra
 * perfectamente funcional con sus migas resueltas solas.
 *
 * El registro es por montaje: `usePageChrome` publica al montar y limpia al
 * desmontar, así que navegar de una pantalla a otra nunca deja puesto el título
 * de la anterior.
 *
 * Este archivo tiene el contexto y sus tipos; el proveedor vive en
 * `PageChromeContext.tsx` y los hooks en `usePageChrome.ts`. Separarlos es lo
 * que deja a cada archivo exportando una sola clase de cosa, que es lo que Fast
 * Refresh necesita para no recargar la página entera en cada edición.
 */

export interface ContextPart {
  text: string;
  /** `danger` es el único tono que sobrevive al estado condensado. */
  tone?: "danger";
  strong?: boolean;
}

export interface PageChrome {
  title?: string;
  context?: ContextPart[];
  badge?: { label: string; tone?: "success" | "neutral" };
  actions?: ReactNode;
  primaryAction?: { label: string; onClick: () => void };
  /** Override. Por defecto las migas se resuelven desde la ruta. */
  breadcrumbs?: Crumb[];
  /**
   * La zona de scroll de la pantalla, SÓLO para el estado condensado.
   *
   * Opcional a propósito: sin él la barra funciona igual y simplemente no
   * condensa. Una pantalla se suma cuando quiera, con una línea.
   */
  scrollRoot?: RefObject<HTMLElement | null>;
}

export interface PageChromeStore {
  chrome: PageChrome;
  setChrome: (chrome: PageChrome | null) => void;
  /** Nombre real del registro actual, publicado por una ficha ya cargada. */
  dynamicLabel: string | null;
  setDynamicLabel: (label: string | null) => void;
}

export const PageChromeContext = createContext<PageChromeStore | null>(null);
