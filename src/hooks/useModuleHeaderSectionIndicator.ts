import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";

export type ModuleHeaderIndicatorMotion = "travel" | "none";

export interface ModuleHeaderIndicatorRect {
  left: number;
  width: number;
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

/** Barra inferior que viaja entre pestañas del ModuleHeader (misma curva que el riel). */
export function useModuleHeaderSectionIndicator(
  navRef: RefObject<HTMLElement | null>,
  activeKey: string | null,
) {
  const [rect, setRect] = useState<ModuleHeaderIndicatorRect>({ left: 0, width: 0, visible: false });
  const [motion, setMotion] = useState<ModuleHeaderIndicatorMotion>("none");
  const prevKey = useRef<string | null>(null);

  const measure = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const link = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!link) {
      setRect({ left: 0, width: 0, visible: false });
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    setRect({
      left: linkRect.left - navRect.left,
      width: linkRect.width,
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
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure]);

  return { rect, motion };
}
