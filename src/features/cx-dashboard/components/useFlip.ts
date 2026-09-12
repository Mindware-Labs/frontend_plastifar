import { useLayoutEffect, useRef } from "react";

/**
 * FLIP para una lista que se reordena.
 *
 * ------------------------------------------------------------------
 * QUÉ PROBLEMA RESUELVE
 * ------------------------------------------------------------------
 * Al ordenar la bandeja por otra columna, las filas se teletransportan: el
 * navegador repinta la tabla en el orden nuevo y el ojo pierde el rastro de la
 * fila que venía mirando. En una cola de operación eso importa — las filas son
 * cosas que estás siguiendo, no celdas intercambiables. Un ticket que salta del
 * quinto lugar al primero cuando ordenás por vencimiento ES información, y hoy
 * esa información se pierde entre dos cuadros.
 *
 * ------------------------------------------------------------------
 * CÓMO FUNCIONA
 * ------------------------------------------------------------------
 * First · Last · Invert · Play. Se mide dónde estaba cada fila ANTES del
 * repintado, se mide dónde quedó DESPUÉS, y se la devuelve a su sitio viejo con
 * un `transform` para soltarla enseguida hacia el nuevo. El navegador ya hizo el
 * layout una sola vez; lo que se anima es sólo `transform`, que no vuelve a
 * tocarlo.
 *
 * `useLayoutEffect` y no `useEffect`: hay que aplicar la inversión ANTES de que
 * el navegador pinte, o se ve el salto igual y después la animación encima.
 */

/** Distancia máxima que se anima. Más allá, la fila aparece donde toca. */
const MAX_TRAVEL = 400;

export function useFlip<Key extends string | number>(keys: readonly Key[]) {
  const nodes = useRef(new Map<Key, HTMLElement>());
  const previous = useRef(new Map<Key, number>());

  useLayoutEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const next = new Map<Key, number>();

    for (const [key, node] of nodes.current) {
      const top = node.getBoundingClientRect().top;
      next.set(key, top);

      const before = previous.current.get(key);
      // Una fila que no estaba antes no viaja: aparecer desde una posición
      // inventada es peor que aparecer.
      if (before === undefined || reduce) continue;

      const delta = before - top;
      if (delta === 0 || Math.abs(delta) > MAX_TRAVEL) continue;

      node.style.transition = "none";
      node.style.transform = `translateY(${delta}px)`;

      // Dos cuadros: uno para que el navegador acepte la posición invertida,
      // otro para soltarla. Con uno solo, algunos motores agrupan los dos
      // estilos y no hay transición que interpolar.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          node.style.transition = "transform 320ms cubic-bezier(0.16, 1, 0.3, 1)";
          node.style.transform = "";
        });
      });
    }

    previous.current = next;
  }, [keys]);

  /** Se pasa como `ref` a cada elemento de la lista. */
  return (key: Key) => (node: HTMLElement | null) => {
    if (node) nodes.current.set(key, node);
    else nodes.current.delete(key);
  };
}
