import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { CLOSE_EASING, OPEN_FRAME, capture, getSpringEasing, prefersReducedMotion, releaseOnFinish } from "./motion";

/** Animaciones de apertura y cierre para paneles desplegables y popovers. */

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
  openMs?: number;
  closeMs?: number;
  /** Misma curva spring en cierre que en apertura (más coherente en popovers densos). */
  symmetricEasing?: boolean;
  /** Escalonado de `[data-motion-item]`; desactivar si el contenido cambia de alto al abrir. */
  itemStagger?: boolean;
  /** Movimiento más sutil: paneles inline cuyo alto crece con el contenido (p. ej. textareas autoGrow). */
  fluid?: boolean;
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

function openFromFrame(direction: DisclosureDirection, fluid: boolean, reduced: boolean): Keyframe {
  if (fluid) return closedFrame(direction, 2, 0.99, reduced);
  return closedFrame(direction, 5, 0.972, reduced);
}

function closeToFrame(direction: DisclosureDirection, fluid: boolean, reduced: boolean): Keyframe {
  if (fluid) return closedFrame(direction, 2, 0.992, reduced);
  return closedFrame(direction, 3, 0.985, reduced);
}

export function useDisclosureMotion<T extends HTMLElement>(
  open: boolean,
  {
    direction = "down",
    openMs = OPEN_MS,
    closeMs = CLOSE_MS,
    symmetricEasing = false,
    itemStagger = true,
    fluid = false,
  }: DisclosureMotionOptions = {},
): DisclosureMotion<T> {
  const [exiting, setExiting] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  const ref = useRef<T>(null);
  const panelAnim = useRef<Animation | null>(null);
  const itemAnims = useRef<Animation[]>([]);
  /** Evita reiniciar la animación si el anclaje cambia de arriba/abajo con el panel abierto. */
  const directionRef = useRef(direction);

  // La salida se decide en el propio render del cierre: si esperase al efecto, el panel ya estaría desmontado.
  if (open !== prevOpen) {
    if (open) directionRef.current = direction;
    setPrevOpen(open);
    setExiting(!open && !snapping);
    if (snapping) setSnapping(false);
  } else if (!open && !exiting) {
    directionRef.current = direction;
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

    const dir = directionRef.current;
    const reduced = prefersReducedMotion();
    const running = panelAnim.current;
    const from = running ? capture(el) : open ? openFromFrame(dir, fluid, reduced) : OPEN_FRAME;
    // La opacidad pintada mide cuánto camino queda: la duración se escala con él.
    const progress = Number(from.opacity);
    running?.cancel();

    const closeEasing = symmetricEasing && !reduced ? getSpringEasing() : CLOSE_EASING;

    if (open) {
      const anim = el.animate([from, OPEN_FRAME], {
        duration: reduced ? REDUCED_OPEN_MS : Math.max(120, Math.round(openMs * (1 - progress))),
        easing: reduced ? "ease-out" : getSpringEasing(),
        fill: "both",
      });
      panelAnim.current = anim;
      releaseOnFinish(anim, panelAnim);

      if (itemStagger && !running && !reduced) {
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

    const anim = el.animate([from, closeToFrame(dir, fluid, reduced)], {
      duration: reduced ? REDUCED_CLOSE_MS : Math.max(80, Math.round(closeMs * progress)),
      easing: closeEasing,
      fill: "both",
    });
    panelAnim.current = anim;
    anim.onfinish = () => {
      if (panelAnim.current !== anim) return;
      panelAnim.current = null;
      setExiting(false);
    };
  }, [open, closeMs, fluid, itemStagger, openMs, symmetricEasing]);

  return { mounted: open || exiting, exiting, ref, snap };
}
