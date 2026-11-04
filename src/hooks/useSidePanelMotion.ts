import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { getSpringEasing, prefersReducedMotion, releaseOnFinish } from "./motion";

/** Entrada/salida del compositor de bandeja (misma gramática que plf-side-panel-in en index.css). */

const OPEN_MS = 440;
const CLOSE_MS = 360;
const REDUCED_OPEN_MS = 90;
const REDUCED_CLOSE_MS = 70;

const VISIBLE_FRAME: Keyframe = { opacity: 1, transform: "none", filter: "none" };

function hiddenFrame(reduced: boolean): Keyframe {
  if (reduced) return { opacity: 0, transform: "none", filter: "none" };
  return { opacity: 0, transform: "translateX(18px) scale(0.99)", filter: "blur(1.25px)" };
}

function capturePanel(el: HTMLElement): Keyframe {
  const style = getComputedStyle(el);
  return { opacity: style.opacity, transform: style.transform, filter: style.filter };
}

interface SidePanelMotion<T extends HTMLElement> {
  mounted: boolean;
  exiting: boolean;
  ref: RefObject<T | null>;
  snap: () => void;
}

export function useSidePanelMotion<T extends HTMLElement>(open: boolean): SidePanelMotion<T> {
  const [exiting, setExiting] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  const ref = useRef<T>(null);
  const panelAnim = useRef<Animation | null>(null);

  if (open !== prevOpen) {
    setPrevOpen(open);
    setExiting(!open && !snapping);
    if (snapping) setSnapping(false);
  }

  const snap = useCallback(() => {
    panelAnim.current?.cancel();
    panelAnim.current = null;
    setSnapping(true);
    setExiting(false);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = prefersReducedMotion();
    const running = panelAnim.current;
    const from = running ? capturePanel(el) : open ? hiddenFrame(reduced) : VISIBLE_FRAME;
    const progress = Number(from.opacity ?? 1);
    running?.cancel();

    const easing = reduced ? "ease-out" : getSpringEasing();

    if (open) {
      const anim = el.animate([from, VISIBLE_FRAME], {
        duration: reduced ? REDUCED_OPEN_MS : Math.max(160, Math.round(OPEN_MS * (1 - progress))),
        easing,
        fill: "both",
      });
      panelAnim.current = anim;
      releaseOnFinish(anim, panelAnim);
      return;
    }

    const anim = el.animate([from, hiddenFrame(reduced)], {
      duration: reduced ? REDUCED_CLOSE_MS : Math.max(120, Math.round(CLOSE_MS * progress)),
      easing,
      fill: "both",
    });
    panelAnim.current = anim;
    anim.onfinish = () => {
      if (panelAnim.current !== anim) return;
      panelAnim.current = null;
      setExiting(false);
    };
  }, [open]);

  return { mounted: open || exiting, exiting, ref, snap };
}
