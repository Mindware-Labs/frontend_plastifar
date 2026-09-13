/**
 * Pila de capas abiertas (dialogos, editores a pantalla completa): solo la de
 * arriba responde a Escape, asi un modal sobre otro no cierra los dos a la vez.
 */
const stack: symbol[] = [];

export interface OverlayHandle {
  /** True si ninguna capa se abrio encima de esta. */
  isTop: () => boolean;
  /** Baja idempotente: llamarla dos veces no toca a las demas capas. */
  close: () => void;
}

export function openOverlay(): OverlayHandle {
  const token = Symbol("overlay");
  stack.push(token);
  return {
    isTop: () => stack[stack.length - 1] === token,
    close: () => {
      const index = stack.lastIndexOf(token);
      if (index !== -1) stack.splice(index, 1);
    },
  };
}
