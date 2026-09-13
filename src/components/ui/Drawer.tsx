import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";

interface DrawerProps {
  title: string;
  /** Linea corta sobre el titulo: situa la accion dentro del modulo. */
  eyebrow?: string;
  description?: ReactNode;
  onClose: () => void;
  /** Acciones del pie, separadas del cuerpo por un filete. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Panel lateral. Mismo contrato y mismo comportamiento que `Modal` —portal
 * sobre document.body, Esc, trampa de foco, cierre al pulsar el velo— pero
 * anclado al borde derecho y a la altura completa.
 *
 * Existe para formularios largos que el dialogo centrado no aguanta. El
 * generador de reportes tiene hasta siete criterios; en un `Modal` de 512px de
 * ancho quedaban apretados en dos columnas o desbordaban en un scroll interno
 * que escondia el boton de generar. El panel lateral les da altura, que es
 * justo lo que sobra en una pantalla ancha.
 */
export function Drawer({ title, eyebrow, description, onClose, footer, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useDialogBehavior(panelRef, onClose);

  return createPortal(
    <div
      className="animate-plf-scrim-in fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        /* Panel flotante y no pared: separado del borde por un margen y con
           radio completo, igual que el carril lateral y las tarjetas. Pegado al
           canto derecho, el drawer era la unica superficie del sistema que
           todavia se comportaba como un bloque de cromo.

           El `border-l` se fue con el mismo argumento que en el carril: un
           borde de un solo lado contra una esquina redondeada deja muesca. */
        className="animate-plf-drawer-in m-2.5 flex h-[calc(100%-1.25rem)] w-full max-w-[460px]
          flex-col overflow-hidden rounded-card border border-line bg-white shadow-dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
          <div>
            {eyebrow && (
              <p className="font-heading text-[10px] font-medium uppercase tracking-[0.07em] text-faint">
                {eyebrow}
              </p>
            )}
            <h2
              id={titleId}
              className="mt-1.5 font-heading text-[18px] font-semibold tracking-[-0.015em] text-ink"
            >
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1.5 text-[12.5px] leading-relaxed text-subtle">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1.5 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-edge
              text-subtle transition-colors hover:bg-fill hover:text-ink
              focus-visible:ring-3 focus-visible:ring-brand-red/20 outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line bg-fill px-6 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
