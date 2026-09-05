import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

interface Position {
  /** Centro horizontal deseado, en pixeles de ventana. */
  left: number;
  top: number;
  /** Debajo del disparador cuando arriba no cabe. */
  below: boolean;
}

/** Margen minimo con el borde de la ventana. */
const EDGE = 8;

/**
 * Tooltip propio, sin libreria: aparece al pasar el mouse o al enfocar con
 * teclado, mismo vocabulario que el panel flotante (filete, radio de 2px,
 * sombra de panel flotante).
 *
 * Se renderiza en un portal con posicion fija. DESIGN.md decia que el portal
 * llegaria cuando un uso quedara cerca de un borde que recorta: DataTable es
 * `overflow-x-auto`, lo que vuelve el eje vertical `auto` tambien, y la burbuja
 * de la primera fila se cortaba contra el borde superior de la tabla. Este es
 * ese uso.
 */
/** Lo que ya puede recibir foco por si mismo; envolverlo anadiria una parada extra. */
const focusableSelector =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Tooltip({ content, children }: TooltipProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const [left, setLeft] = useState(0);
  // El envoltorio solo se vuelve enfocable cuando su contenido no lo es. Con un
  // tabIndex fijo, cada fila de la tabla anadia una parada que no anuncia nada,
  // y sobre un boton obligaba a pulsar Tab dos veces para llegar a la accion.
  const [needsTabStop, setNeedsTabStop] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    setNeedsTabStop(!triggerRef.current?.querySelector(focusableSelector));
  }, [children]);

  function show() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // 104 px cubre una burbuja de tres lineas mas su separacion; si no cabe
    // encima, se pinta debajo en vez de cortarse contra el borde de la ventana.
    const below = rect.top < 104;
    const center = rect.left + rect.width / 2;
    setPosition({ left: center, top: below ? rect.bottom + 8 : rect.top - 8, below });
    setLeft(center);
  }

  // Con el ancho ya medido, se mete la burbuja dentro de la ventana: centrada
  // sobre su disparador cuando cabe, pegada al margen cuando no. Sin esto, una
  // burbuja sobre la ultima columna de la tabla se sale por la derecha.
  useLayoutEffect(() => {
    if (!position) return;
    const width = bubbleRef.current?.offsetWidth ?? 0;
    const half = width / 2;
    const min = EDGE + half;
    const max = window.innerWidth - EDGE - half;
    const clamped = max < min ? window.innerWidth / 2 : Math.min(Math.max(position.left, min), max);
    if (clamped !== left) setLeft(clamped);
  }, [position, left]);

  return (
    <>
      <span
        className="relative inline-flex"
        onMouseEnter={show}
        onMouseLeave={() => setPosition(null)}
        onFocus={show}
        onBlur={() => setPosition(null)}
        // WCAG 1.4.13: el contenido que aparece al pasar el mouse o al enfocar
        // se debe poder descartar sin mover el puntero ni el foco.
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !position) return;
          event.stopPropagation();
          setPosition(null);
        }}
      >
        <span
          ref={triggerRef}
          tabIndex={needsTabStop ? 0 : undefined}
          aria-describedby={position ? id : undefined}
          className="outline-none rounded-edge focus-visible:ring-3 focus-visible:ring-brand-red/25"
        >
          {children}
        </span>
      </span>

      {position &&
        createPortal(
          <span
            ref={bubbleRef}
            id={id}
            role="tooltip"
            // Anclada en el origen y movida con transform: un `left` grande deja
            // a un elemento fijo solo con el ancho que queda hasta el borde
            // derecho, y la burbuja salia estrangulada en una columna de texto.
            style={{
              left: 0,
              top: 0,
              transform: `translate(${left}px, ${position.top}px)
                translate(-50%, ${position.below ? "0" : "-100%"})`,
            }}
            className="animate-plf-fade pointer-events-none fixed z-50 w-max max-w-[280px] whitespace-normal
              rounded-edge border border-line bg-white px-2.5 py-1.5 text-[11.5px] leading-relaxed
              text-ink shadow-panel"
          >
            {content}
          </span>,
          document.body,
        )}
    </>
  );
}
