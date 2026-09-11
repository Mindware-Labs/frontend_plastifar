import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { CLOSE_EASING, OPEN_FRAME, capture, getSpringEasing, prefersReducedMotion, releaseOnFinish } from "./motion";

/**
 * Apertura y cierre de un panel desplegable (select, menú, popover) con Web Animations.
 *
 * Interrumpible de verdad: cada cambio de sentido parte del estado que el panel
 * tiene pintado en ese instante, con la curva propia de ese sentido. Abrir y
 * cerrar a toda velocidad nunca salta ni acumula retraso. La apertura sigue un
 * resorte (--ease-plf-spring) y el cierre una salida corta que se percibe al momento.
 *
 * Uso: `const motion = useDisclosureMotion(open)`; se monta el panel mientras
 * `motion.mounted`, se le pasa `motion.ref`, y los hijos con `data-motion-item`
 * entran escalonados. `snap()` desmonta sin animar (scroll, resize).
 */

const OPEN_MS = 280;
const CLOSE_MS = 140;
const REDUCED_OPEN_MS = 90;
const REDUCED_CLOSE_MS = 60;

// Escalonado de las opciones: casi imperceptible por separado, orgánico en conjunto.
const ITEM_MS = 200;
const ITEM_LEAD_MS = 30;
const ITEM_STEP_MS = 14;
const ITEM_STEP_CAP = 6;

export type DisclosureDirection = "down" | "up";

interface DisclosureMotionOptions {
  /** Hacia dónde se despliega el panel respecto a su disparador. */
  direction?: DisclosureDirection;
}

interface DisclosureMotion<T extends HTMLElement> {
  /** Mientras es true el panel debe estar en el DOM, también durante la salida. */
  mounted: boolean;
  /** True solo durante la animación de cierre: el panel ya no debe recibir eventos. */
  exiting: boolean;
  ref: RefObject<T | null>;
  /** Desmonta al instante, sin animación de salida. */
  snap: () => void;
}

function closedFrame(direction: DisclosureDirection, distance: number, scale: number, reduced: boolean): Keyframe {
  if (reduced) return { opacity: 0, transform: "none" };
  return { opacity: 0, transform: `translateY(${direction === "down" ? -distance : distance}px) scale(${scale})` };
}

export function useDisclosureMotion<T extends HTMLElement>(
  open: boolean,
  { direction = "down" }: DisclosureMotionOptions = {},
): DisclosureMotion<T> {
  const [exiting, setExiting] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  const ref = useRef<T>(null);
  const panelAnim = useRef<Animation | null>(null);
  const itemAnims = useRef<Animation[]>([]);

  // La salida se decide en el propio render del cierre: si esperase al efecto, el panel ya estaría desmontado.
  if (open !== prevOpen) {
    setPrevOpen(open);
    setExiting(!open && !snapping);
    if (snapping) setSnapping(false);
  }

  const snap = useCallback(() => {
    panelAnim.current?.cancel();
    panelAnim.current = null;
    for (const anim of itemAnims.current) anim.cancel();
    itemAnims.current = [];
    setSnapping(true);
    setExiting(false);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = prefersReducedMotion();
    const running = panelAnim.current;
    const from = running ? capture(el) : open ? closedFrame(direction, 6, 0.965, reduced) : OPEN_FRAME;
    // La opacidad pintada mide cuánto camino queda: la duración se escala con él.
    const progress = Number(from.opacity);
    running?.cancel();

    if (open) {
      const anim = el.animate([from, OPEN_FRAME], {
        duration: reduced ? REDUCED_OPEN_MS : Math.max(120, Math.round(OPEN_MS * (1 - progress))),
        easing: reduced ? "ease-out" : getSpringEasing(),
        fill: "both",
      });
      panelAnim.current = anim;
      releaseOnFinish(anim, panelAnim);

      if (!running && !reduced) {
        const items = el.querySelectorAll<HTMLElement>("[data-motion-item]");
        itemAnims.current = Array.from(items, (item, index) =>
          item.animate([{ opacity: 0, transform: "translateY(-3px)" }, OPEN_FRAME], {
            duration: ITEM_MS,
            delay: ITEM_LEAD_MS + Math.min(index, ITEM_STEP_CAP) * ITEM_STEP_MS,
            easing: CLOSE_EASING,
            fill: "backwards",
          }),
        );
      }
      return;
    }

    // Cierre: las opciones se asientan al instante y solo el panel se retira.
    for (const anim of itemAnims.current) anim.finish();
    itemAnims.current = [];

    const anim = el.animate([from, closedFrame(direction, 4, 0.98, reduced)], {
      duration: reduced ? REDUCED_CLOSE_MS : Math.max(60, Math.round(CLOSE_MS * progress)),
      easing: CLOSE_EASING,
      fill: "both",
    });
    panelAnim.current = anim;
    anim.onfinish = () => {
      if (panelAnim.current !== anim) return;
      panelAnim.current = null;
      setExiting(false);
    };
  }, [open, direction]);

  return { mounted: open || exiting, exiting, ref, snap };
}
