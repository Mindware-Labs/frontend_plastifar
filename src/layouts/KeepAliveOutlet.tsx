import { useQueryClient } from "@tanstack/react-query";
import { Activity, useContext, useEffect, useInsertionEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  UNSAFE_LocationContext,
  UNSAFE_RouteContext,
  useLocation,
  useNavigationType,
  type Location,
  type NavigationType,
} from "react-router-dom";
import { useEmailCounts } from "../context/useEmailCounts";
import { KEPT_VIEW_TTL_MS, KeptViewContext, MAX_KEPT_VIEWS, keptViewKey, rememberLocation } from "../lib/keptViews";
import { PortalHostContext } from "../lib/portalHost";

interface KeptView {
  key: string;
  // Sube cuando la vista caduca: cambia la clave de React y se monta de cero.
  instance: number;
  element: ReactNode;
  location: Location;
  routing: { location: Location; navigationType: NavigationType };
  hiddenAt: number | null;
}

// El envoltorio no genera caja: la página sigue siendo hija directa del layout flex.
const VIEW_STYLE = { display: "contents" } as const;

const portalHosts = new Map<string, HTMLDivElement>();

// Un contenedor de portales por vista, hijo de body: se oculta con la vista aunque el modal viva fuera de su árbol.
function portalHostFor(id: string): HTMLDivElement {
  let host = portalHosts.get(id);
  if (!host) {
    host = document.createElement("div");
    host.dataset.plfKeptView = id;
    host.style.display = "contents";
    document.body.appendChild(host);
    portalHosts.set(id, host);
  }
  return host;
}

const viewId = (view: KeptView) => `${view.key}:${view.instance}`;

function syncViews(
  views: KeptView[],
  activeKey: string | null,
  element: ReactNode,
  location: Location,
  navigationType: NavigationType,
  now: number,
): KeptView[] {
  let next = views.map((view) => (view.key !== activeKey && view.hiddenAt === null ? { ...view, hiddenAt: now } : view));

  if (activeKey !== null) {
    const existing = next.find((view) => view.key === activeKey);
    const expired = existing?.hiddenAt != null && now - existing.hiddenAt > KEPT_VIEW_TTL_MS;
    const routing =
      existing && existing.location === location && !expired ? existing.routing : { location, navigationType };
    const updated: KeptView = {
      key: activeKey,
      instance: existing === undefined ? 0 : expired ? existing.instance + 1 : existing.instance,
      element,
      location,
      routing,
      hiddenAt: null,
    };
    next = existing ? next.map((view) => (view.key === activeKey ? updated : view)) : [...next, updated];
  }

  next = next.filter((view) => view.hiddenAt === null || now - view.hiddenAt <= KEPT_VIEW_TTL_MS);
  const overflow = next.length - MAX_KEPT_VIEWS;
  if (overflow > 0) {
    const oldest = next
      .filter((view) => view.hiddenAt !== null)
      .sort((a, b) => a.hiddenAt! - b.hiddenAt!)
      .slice(0, overflow)
      .map((view) => view.key);
    next = next.filter((view) => !oldest.includes(view.key));
  }
  return next;
}

/** Outlet que oculta con Activity, sin desmontar, las vistas de Correo y de «Tickets y Tareas» al salir de ellas. */
export function KeepAliveOutlet() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const outlet = useContext(UNSAFE_RouteContext).outlet;
  const activeKey = keptViewKey(location.pathname);
  const [views, setViews] = useState<KeptView[]>([]);

  const active = activeKey === null ? undefined : views.find((view) => view.key === activeKey);
  const outdated =
    (activeKey !== null && (active === undefined || active.location !== location || active.element !== outlet || active.hiddenAt !== null)) ||
    views.some((view) => view.key !== activeKey && view.hiddenAt === null);
  if (outdated) {
    setViews((current) => syncViews(current, activeKey, outlet, location, navigationType, Date.now()));
  }

  const activeId = active && !outdated ? viewId(active) : null;
  const activeIdRef = useRef(activeId);

  // Antes de los efectos de layout de las páginas: un popover que mide al mostrarse ya encuentra su contenedor visible.
  useInsertionEffect(() => {
    for (const view of views) {
      const id = viewId(view);
      portalHostFor(id).style.display = id === activeId ? "contents" : "none";
    }
  }, [views, activeId]);

  // Las vistas descartadas ya desmontaron sus portales: se retira su contenedor.
  useEffect(() => {
    const live = new Set(views.map(viewId));
    for (const [id, host] of portalHosts) {
      if (live.has(id)) continue;
      host.remove();
      portalHosts.delete(id);
    }
  }, [views]);

  // display: none borra el scroll: se anota mientras la vista está visible y se repone al volver a ella.
  const scrollMemory = useRef(new Map<string, Map<Element, [number, number]>>());
  useEffect(() => {
    function handleScroll(event: Event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const id = target.closest<HTMLElement>("[data-plf-kept-view]")?.dataset.plfKeptView;
      if (!id || id !== activeIdRef.current) return;
      let memory = scrollMemory.current.get(id);
      if (!memory) scrollMemory.current.set(id, (memory = new Map()));
      memory.set(target, [target.scrollTop, target.scrollLeft]);
    }
    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", handleScroll, { capture: true });
  }, []);

  useLayoutEffect(() => {
    const previous = activeIdRef.current;
    activeIdRef.current = activeId;
    if (activeId === null || activeId === previous) return;
    for (const [element, [top, left]] of scrollMemory.current.get(activeId) ?? []) {
      if (!element.isConnected) continue;
      element.scrollTop = top;
      element.scrollLeft = left;
    }
  }, [activeId]);

  useEffect(() => {
    const live = new Set(views.map(viewId));
    for (const id of scrollMemory.current.keys()) if (!live.has(id)) scrollMemory.current.delete(id);
  }, [views]);

  useEffect(() => {
    rememberLocation(location.pathname, location.search);
  }, [location.pathname, location.search]);

  // Las vistas ocultas no escuchan los avisos en vivo: su caché queda vieja y se relee al volver a ellas.
  const queryClient = useQueryClient();
  const { onInboxChanged, onTicketsChanged } = useEmailCounts();
  useEffect(() => {
    const markHiddenStale = () =>
      void queryClient.invalidateQueries({
        type: "inactive",
        refetchType: "none",
        predicate: (query) => query.queryKey[0] !== "catalog",
      });
    const offs = [onInboxChanged(markHiddenStale), onTicketsChanged(markHiddenStale)];
    return () => offs.forEach((off) => off());
  }, [queryClient, onInboxChanged, onTicketsChanged]);

  return (
    <>
      {views.map((view) => {
        const id = viewId(view);
        return (
          <Activity key={id} mode={view.key === activeKey ? "visible" : "hidden"}>
            <div data-plf-kept-view={id} style={VIEW_STYLE}>
              <UNSAFE_LocationContext.Provider value={view.routing}>
                <KeptViewContext.Provider value={true}>
                  <PortalHostContext.Provider value={portalHostFor(id)}>{view.element}</PortalHostContext.Provider>
                </KeptViewContext.Provider>
              </UNSAFE_LocationContext.Provider>
            </div>
          </Activity>
        );
      })}
      {activeKey === null && outlet}
    </>
  );
}
