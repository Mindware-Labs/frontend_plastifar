import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";

export type ModuleHeaderIndicatorMotion = "travel" | "none";

export interface ModuleHeaderIndicatorRect {
  left: number;
  top: number;
  width: number;
  height: number;
  visible: boolean;
}

const TRAVEL_MS = 320;

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

/** Pastilla activa que viaja entre pestañas del ModuleHeader (misma curva que el riel). */
export function useModuleHeaderSectionIndicator(
  navRef: RefObject<HTMLElement | null>,
  activeKey: string | null,
) {
  const [rect, setRect] = useState<ModuleHeaderIndicatorRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    visible: false,
  });
  const [motion, setMotion] = useState<ModuleHeaderIndicatorMotion>("none");
  const prevKey = useRef<string | null>(null);

  const measure = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const link = nav.querySelector<HTMLElement>('[aria-current="page"], [data-section-active]');
    if (!link) {
      setRect({ left: 0, top: 0, width: 0, height: 0, visible: false });
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    setRect({
      left: linkRect.left - navRect.left,
      top: linkRect.top - navRect.top,
      width: linkRect.width,
      height: linkRect.height,
      visible: true,
    });
  }, [navRef]);

  useLayoutEffect(() => {
    const travel = prevKey.current !== null && activeKey !== null && prevKey.current !== activeKey;
    prevKey.current = activeKey;
    setMotion(travel ? "travel" : "none");
    return followLayoutDuringAnimation(measure, TRAVEL_MS);
  }, [activeKey, measure]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(nav);
    for (const child of nav.querySelectorAll<HTMLElement>("[data-section-tab]")) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  }, [measure, navRef, activeKey]);

  useLayoutEffect(() => {
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure]);

  return { rect, motion };
}
