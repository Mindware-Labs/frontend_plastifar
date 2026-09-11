import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { CLOSE_EASING, OPEN_FRAME, capture, getSpringEasing, prefersReducedMotion, releaseOnFinish } from "./motion";

/**
 * Entrada y salida de un diálogo (modal centrado o sheet lateral) con su telón.
 *
 * El panel entra con el resorte del tema y sale con una retirada corta; el telón
 * funde en paralelo. `requestClose` inicia la salida y `onClose` se llama cuando
 * termina, para que el padre desmonte. Si el padre ya gobierna la salida (por
 * ejemplo con useModalAnimation) la transmite con `exiting`. Pedir el cierre a
 * mitad de la entrada retrocede desde el punto pintado, sin salto.
 */

export type DialogVariant = "modal" | "drawer";

interface DialogMotionOptions {
  variant?: DialogVariant;
  /** Salida gobernada desde fuera: al pasar a true el diálogo se retira. */
  exiting?: boolean;
}

interface DialogMotion {
  isExiting: boolean;
  requestClose: () => void;
  scrimRef: RefObject<HTMLDivElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
}

const TIMING: Record<DialogVariant, { enter: number; exit: number }> = {
  modal: { enter: 280, exit: 160 },
  drawer: { enter: 320, exit: 200 },
};
const REDUCED_TIMING = { enter: 120, exit: 80 };
const SCRIM_ENTER_MS = 200;

function hiddenFrame(variant: DialogVariant, reduced: boolean, leaving: boolean): Keyframe {
  if (reduced) return { opacity: 0, transform: "none" };
  if (variant === "drawer") return { opacity: 1, transform: "translateX(100%)" };
  return { opacity: 0, transform: leaving ? "translateY(6px) scale(0.985)" : "translateY(8px) scale(0.985)" };
}

export function useDialogMotion(
  onClose: () => void,
  { variant = "modal", exiting = false }: DialogMotionOptions = {},
): DialogMotion {
  const [requested, setRequested] = useState(false);
  const isExiting = exiting || requested;
  const scrimRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelAnim = useRef<Animation | null>(null);
  const scrimAnim = useRef<Animation | null>(null);

  // onClose suele ser una flecha nueva en cada render: se lee por ref para no reiniciar la animación.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => setRequested(true), []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const scrim = scrimRef.current;

    const reduced = prefersReducedMotion();
    const running = panelAnim.current;
    const from = running ? capture(panel) : isExiting ? OPEN_FRAME : hiddenFrame(variant, reduced, false);
    const scrimFrom: Keyframe = {
      opacity: scrim && scrimAnim.current ? getComputedStyle(scrim).opacity : isExiting ? 1 : 0,
    };
    running?.cancel();
    scrimAnim.current?.cancel();
    const timing = reduced ? REDUCED_TIMING : TIMING[variant];

    if (!isExiting) {
      const anim = panel.animate([from, OPEN_FRAME], {
        duration: timing.enter,
        easing: reduced ? "ease-out" : getSpringEasing(),
        fill: "both",
      });
      panelAnim.current = anim;
      releaseOnFinish(anim, panelAnim);

      if (scrim) {
        const fade = scrim.animate([scrimFrom, { opacity: 1 }], {
          duration: reduced ? REDUCED_TIMING.enter : SCRIM_ENTER_MS,
          easing: "ease-out",
          fill: "both",
        });
        scrimAnim.current = fade;
        releaseOnFinish(fade, scrimAnim);
      }
      return;
    }

    const anim = panel.animate([from, hiddenFrame(variant, reduced, true)], {
      duration: timing.exit,
      easing: CLOSE_EASING,
      fill: "both",
    });
    panelAnim.current = anim;
    anim.onfinish = () => {
      if (panelAnim.current === anim) onCloseRef.current();
    };

    if (scrim) {
      scrimAnim.current = scrim.animate([scrimFrom, { opacity: 0 }], {
        duration: timing.exit,
        easing: CLOSE_EASING,
        fill: "both",
      });
    }
  }, [isExiting, variant]);

  return { isExiting, requestClose, scrimRef, panelRef };
}
