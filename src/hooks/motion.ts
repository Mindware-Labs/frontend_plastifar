/** Piezas comunes del movimiento de paneles y diálogos: curva, captura del estado pintado y liberación. */

export const OPEN_FRAME: Keyframe = { opacity: 1, transform: "none" };
export const CLOSE_EASING = "cubic-bezier(0.2, 0, 0, 1)";
const FALLBACK_SPRING = "cubic-bezier(0.16, 1, 0.3, 1)";

let springEasing: string | null = null;

/** La curva vive en el tema (index.css) para que CSS y JS compartan exactamente la misma. */
export function getSpringEasing() {
  if (springEasing !== null) return springEasing;
  const declared = getComputedStyle(document.documentElement).getPropertyValue("--ease-plf-spring").trim();
  springEasing =
    declared && CSS.supports("transition-timing-function", declared) ? declared : FALLBACK_SPRING;
  return springEasing;
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Estado tal y como está pintado ahora mismo: el punto de partida de un cambio de sentido. */
export function capture(el: HTMLElement): Keyframe {
  const style = getComputedStyle(el);
  return { opacity: style.opacity, transform: style.transform };
}

/** El estado final coincide con el estilo natural: al terminar se libera la capa compuesta. */
export function releaseOnFinish(anim: Animation, slot: { current: Animation | null }) {
  anim.onfinish = () => {
    if (slot.current !== anim) return;
    anim.cancel();
    slot.current = null;
  };
}
