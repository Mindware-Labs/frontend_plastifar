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

export type PageMotionDirection = "next" | "prev" | "settle";

let pendingPageDirection: PageMotionDirection = "settle";
let pendingPageTimestamp = 0;

/** Registra el sentido del cambio de página al pulsar el paginador. */
export function recordPageDirection(direction: PageMotionDirection) {
  pendingPageDirection = direction;
  pendingPageTimestamp = typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Consume el sentido del último cambio de página; si expiró, usa asentamiento vertical neutro. */
export function consumePageDirection(): PageMotionDirection {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const fresh = now - pendingPageTimestamp < 1500;
  const dir = fresh ? pendingPageDirection : "settle";
  pendingPageDirection = "settle";
  return dir;
}

/**
 * Transición suave de filas (`tbody > tr`) al paginar o filtrar una tabla.
 *
 * - Sin velo blanco (`opacity-60`) ni parpadeo: parte de opacidad alta (`0.42`)
 *   y desplaza solo en el eje vertical (`±5px`) para no alterar nunca el ancho
 *   útil de los contenedores `.overflow-x-auto`.
 * - La cabecera (`thead`) queda completamente quieta.
 */
export function animateTablePageTurn(
  tbody: HTMLTableSectionElement,
  direction: PageMotionDirection = "settle",
) {
  if (prefersReducedMotion() || typeof Element.prototype.animate !== "function") return;

  const rows = Array.from(tbody.querySelectorAll<HTMLTableRowElement>(":scope > tr"));
  if (rows.length === 0) return;

  const dy = direction === "prev" ? -5 : 5;

  rows.forEach((row, index) => {
    row.getAnimations().forEach((anim) => anim.cancel());
    const delay = Math.min(index * 12, 72);
    const anim = row.animate(
      [
        { opacity: 0.42, transform: `translate3d(0, ${dy}px, 0)` },
        { opacity: 1, transform: "none" },
      ],
      {
        duration: 210,
        delay,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "backwards",
      },
    );
    anim.onfinish = () => anim.cancel();
  });
}

/**
 * Transición direccional suave para cuadrículas de tarjetas (ej. 3×3 en Tickets).
 *
 * - Desliza con una brisa direccional corta (`+8px` al avanzar, `-8px` al retroceder)
 *   y un micro-escalonado por fila (`24ms` entre las 3 filas) sin bloquear el clic.
 */
export function animateCardGridPageTurn(
  grid: HTMLElement,
  direction: PageMotionDirection = "settle",
  columns = 3,
) {
  if (prefersReducedMotion() || typeof Element.prototype.animate !== "function") return;

  const cards = Array.from(grid.children) as HTMLElement[];
  if (cards.length === 0) return;

  const dx = direction === "next" ? 8 : direction === "prev" ? -8 : 0;
  const dy = 4;

  cards.forEach((card, index) => {
    card.getAnimations().forEach((anim) => anim.cancel());
    const row = Math.floor(index / Math.max(1, columns));
    const delay = Math.min(row * 24, 72);
    const anim = card.animate(
      [
        {
          opacity: 0.42,
          transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.994)`,
        },
        {
          opacity: 1,
          transform: "none",
        },
      ],
      {
        duration: 240,
        delay,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "backwards",
      },
    );
    anim.onfinish = () => anim.cancel();
  });
}
