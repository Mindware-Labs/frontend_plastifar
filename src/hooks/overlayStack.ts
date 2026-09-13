/** Gestión de pila de capas modales para tecla Escape. */
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
