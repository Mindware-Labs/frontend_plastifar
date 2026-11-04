import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { NavGroup } from "../lib/navigation";

export type SidebarNavTargetKey = string;

/** travel = clic en ruta (resorte); none = acordeón y reposicionado instantáneo. */
export type SidebarIndicatorMotion = "travel" | "none";

export interface SidebarNavIndicatorRect {
  top: number;
  height: number;
  pillLeft: number;
  pillWidth: number;
  markLeft: number;
  markHeight: number;
  markAtEdge: boolean;
  showMark: boolean;
}

interface MatchChild {
  to: string;
  end?: boolean;
}

const ACCORDION_MS = 320;

function routeMatches(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function findActiveChild(pathname: string, children: MatchChild[]) {
  let best: MatchChild | null = null;
  for (const child of children) {
    if (!routeMatches(pathname, child.to, child.end)) continue;
    if (!best || child.to.length > best.to.length) best = child;
  }
  return best;
}

export function resolveSidebarNavTargetKey(
  pathname: string,
  collapsed: boolean,
  groups: NavGroup[],
  isGroupOpen: (group: NavGroup) => boolean,
  visibleChildren: (group: NavGroup) => { to: string; end?: boolean }[],
  isGroupActive: (group: NavGroup) => boolean,
): SidebarNavTargetKey | null {
  if (collapsed) {
    for (const group of groups) {
      if (isGroupActive(group)) return `collapsed:rail:${group.label}`;
    }
    return null;
  }

  for (const group of groups) {
    if (group.children) {
      const children = visibleChildren(group);
      const activeChild = findActiveChild(pathname, children);
      if (activeChild) {
        if (isGroupOpen(group)) return `expanded:child:${activeChild.to}`;
        return `expanded:group:${group.label}`;
      }
      continue;
    }
    if (group.to && routeMatches(pathname, group.to)) {
      return `expanded:top:${group.to}`;
    }
  }

  return null;
}

function followLayoutDuringAnimation(measure: () => void, durationMs: number) {
  measure();
  const start = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    measure();
    if (now - start < durationMs) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

const emptyRect: SidebarNavIndicatorRect = {
  top: 0,
  height: 0,
  pillLeft: 0,
  pillWidth: 0,
  markLeft: 0,
  markHeight: 16,
  markAtEdge: true,
  showMark: false,
};

/** Un único highlight medido: nunca se intercambia con estilos de fila (evita parpadeos). */
export function useSidebarNavIndicator(
  activeKey: SidebarNavTargetKey | null,
  layoutKey: string,
  pathname: string,
) {
  const navRef = useRef<HTMLElement | null>(null);
  const navListRef = useRef<HTMLDivElement | null>(null);
  const targetsRef = useRef<Map<SidebarNavTargetKey, HTMLElement>>(new Map());
  const [rect, setRect] = useState<SidebarNavIndicatorRect | null>(null);
  const [motionReady, setMotionReady] = useState(false);
  const [indicatorMotion, setIndicatorMotion] = useState<SidebarIndicatorMotion>("none");
  const primedRef = useRef(false);
  const prevPathnameRef = useRef(pathname);
  const prevLayoutKeyRef = useRef(layoutKey);

  const registerTarget = useCallback(
    (key: SidebarNavTargetKey) => (node: HTMLElement | null) => {
      if (node) targetsRef.current.set(key, node);
      else targetsRef.current.delete(key);
    },
    [],
  );

  const measure = useCallback(() => {
    const nav = navRef.current;
    if (!nav || !activeKey) {
      if (!activeKey) setRect(null);
      return;
    }

    const el = targetsRef.current.get(activeKey);
    if (!el) return;

    const navBox = nav.getBoundingClientRect();
    const elBox = el.getBoundingClientRect();
    const top = elBox.top - navBox.top + nav.scrollTop;
    const height = elBox.height;
    const pillLeft = elBox.left - navBox.left;
    const pillWidth = elBox.width;

    const isChild = activeKey.startsWith("expanded:child:");
    const isRail = activeKey.startsWith("collapsed:rail:");
    const showMark = !isChild;
    const markAtEdge = !isChild;
    const markHeight = showMark ? 16 : 0;
    const markLeft = isChild
      ? pillLeft
      : isRail
        ? pillLeft - 16
        : Math.max(0, pillLeft - 8);

    setRect({
      top,
      height,
      pillLeft,
      pillWidth,
      markLeft,
      markHeight,
      markAtEdge,
      showMark,
    });

    if (!primedRef.current) {
      primedRef.current = true;
      setMotionReady(false);
      requestAnimationFrame(() => setMotionReady(true));
    }
  }, [activeKey]);

  const measureRef = useRef(measure);
  measureRef.current = measure;
  const runMeasure = useCallback(() => {
    measureRef.current();
  }, []);

  useLayoutEffect(() => {
    const routeChanged = prevPathnameRef.current !== pathname;
    prevPathnameRef.current = pathname;

    if (routeChanged) {
      setIndicatorMotion("travel");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => runMeasure());
      });
      return;
    }

    runMeasure();
  }, [pathname, activeKey, runMeasure]);

  useLayoutEffect(() => {
    if (prevLayoutKeyRef.current === layoutKey) return;
    prevLayoutKeyRef.current = layoutKey;
    setIndicatorMotion("none");
    return followLayoutDuringAnimation(runMeasure, ACCORDION_MS);
  }, [layoutKey, runMeasure]);

  useEffect(() => {
    if (indicatorMotion !== "travel") return;
    const end = window.setTimeout(() => setIndicatorMotion("none"), 400);
    return () => window.clearTimeout(end);
  }, [indicatorMotion, pathname]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const onScroll = () => {
      setIndicatorMotion("none");
      runMeasure();
    };
    nav.addEventListener("scroll", onScroll, { passive: true });
    return () => nav.removeEventListener("scroll", onScroll);
  }, [runMeasure]);

  useLayoutEffect(() => {
    const list = navListRef.current;
    if (!list) return;

    const ro = new ResizeObserver(() => runMeasure());
    ro.observe(list);
    return () => ro.disconnect();
  }, [runMeasure]);

  return {
    navRef,
    navListRef,
    registerTarget,
    rect,
    motionReady,
    indicatorMotion,
    visible: Boolean(activeKey && rect),
    emptyRect,
  };
}
