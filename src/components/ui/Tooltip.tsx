import { useId, useState, type ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

/**
 * Tooltip propio, sin libreria: aparece al pasar el mouse o al enfocar con
 * teclado, mismo vocabulario que el panel flotante (filete, radio de 2px,
 * sombra de panel flotante). Vive dentro del flujo normal a proposito — los
 * usos actuales (avatares en una celda) no se recortan con el scroll
 * horizontal de la tabla, así que no hace falta el costo de un portal.
 */
export function Tooltip({ content, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span tabIndex={0} aria-describedby={open ? id : undefined} className="outline-none rounded-full focus-visible:ring-3 focus-visible:ring-brand-red/25">
        {children}
      </span>

      {open && (
        <span
          id={id}
          role="tooltip"
          className="animate-plf-fade pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2
            whitespace-nowrap rounded-edge border border-line bg-white px-2.5 py-1.5 text-[11.5px] leading-relaxed
            text-ink shadow-[0_4px_8px_rgba(27,27,29,0.04),0_24px_48px_-20px_rgba(27,27,29,0.28)]"
        >
          {content}
        </span>
      )}
    </span>
  );
}
