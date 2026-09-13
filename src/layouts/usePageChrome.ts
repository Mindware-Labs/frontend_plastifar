import { useContext, useEffect } from "react";
import { PageChromeContext, type PageChrome } from "./pageChromeStore";

/** Lo lee el layout para pintar la barra. */
export function usePageChromeStore() {
  const store = useContext(PageChromeContext);
  if (!store) {
    throw new Error("usePageChromeStore debe usarse dentro de PageChromeProvider");
  }
  return store;
}

/**
 * Declara el chrome de la pantalla actual.
 *
 * El objeto se serializa para la dependencia del efecto: pasarlo en línea es lo
 * natural en el sitio de llamada, y comparar por referencia volvería a publicar
 * en cada render. `actions`, `primaryAction` y `scrollRoot` quedan fuera de esa
 * firma —un nodo React, una función y un ref no se serializan— y se comparan
 * por referencia aparte.
 */
export function usePageChrome(chrome: PageChrome) {
  const store = useContext(PageChromeContext);
  const setChrome = store?.setChrome;

  const signature = JSON.stringify({
    title: chrome.title,
    context: chrome.context,
    badge: chrome.badge,
    primaryLabel: chrome.primaryAction?.label,
    breadcrumbs: chrome.breadcrumbs,
  });

  const { actions, primaryAction, scrollRoot } = chrome;

  useEffect(() => {
    if (!setChrome) return;
    const parsed = JSON.parse(signature) as Omit<
      PageChrome,
      "actions" | "primaryAction" | "scrollRoot"
    >;
    setChrome({ ...parsed, actions, primaryAction, scrollRoot });
    return () => setChrome(null);
  }, [setChrome, signature, actions, primaryAction, scrollRoot]);
}
