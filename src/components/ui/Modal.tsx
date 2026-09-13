import { X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useDialogMotion } from "../../hooks/useDialogMotion";

export interface ModalProps {
  title: string;
  /** Línea corta sobre el título: sitúa la acción dentro del módulo. */
  eyebrow?: string;
  description?: ReactNode;
  onClose: () => void;
  /** Acciones del pie, separadas del cuerpo por un filete. */
  footer?: ReactNode | ((helpers: { requestClose: () => void; close: () => void }) => ReactNode);
  children: ReactNode;
  /** Si el padre ya controla la animación de salida (ej: useModalAnimation) */
  isExiting?: boolean;
  onRequestClose?: () => void;
  maxWidth?: string;
  /** Asentamiento del modal cuando el envío no prospera: baja 3px y vuelve. */
  settle?: boolean;
}

/**
 * Diálogo modal del panel con diseño SaaS moderno y compacto:
 * Bordes suaves rounded-xl, cabecera y pie estructurados y espaciado optimizado.
 */
export function Modal({
  title,
  eyebrow,
  description,
  onClose,
  footer,
  children,
  isExiting: externalIsExiting,
  onRequestClose: externalRequestClose,
  maxWidth = "max-w-lg",
  settle = false,
}: ModalProps) {
  const motion = useDialogMotion(onClose, { exiting: externalIsExiting });
  const { isExiting, scrimRef, panelRef } = motion;
  const requestClose = externalRequestClose ?? motion.requestClose;

  const titleId = useId();
  const descriptionId = useId();

  useDialogBehavior(panelRef, requestClose);

  return createPortal(
    <div
      ref={scrimRef}
      inert={isExiting ? true : undefined}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-[2px] ${
        isExiting ? "pointer-events-none" : ""
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isExiting) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`${
          isExiting ? "pointer-events-none" : ""
        } ${
          settle ? "animate-plf-settle" : ""
        } flex max-h-full w-full ${maxWidth} flex-col overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-[0_12px_36px_rgba(27,27,29,0.14)] transition-[max-width] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]`}
      >
        {/* Cabecera compacta con borde nítido y buena jerarquía */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line bg-zinc-50/50 px-6 py-4">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p
                key={eyebrow}
                className="animate-plf-header-fade font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400"
              >
                {eyebrow}
              </p>
            )}
            <h2
              key={title}
              id={titleId}
              className="animate-plf-header-fade font-heading text-[16px] font-bold tracking-tight text-ink leading-snug"
            >
              {title}
            </h2>
            {description && (
              <div
                key={typeof description === "string" ? description : undefined}
                id={descriptionId}
                className="animate-plf-header-fade mt-1 text-[12px] leading-relaxed text-subtle"
              >
                {description}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={requestClose}
            aria-label="Cerrar"
            title="Cerrar (Esc)"
            className="-mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-subtle outline-none transition-colors hover:bg-zinc-200/60 hover:text-ink active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-red/25 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo del modal */}
        <div className="overflow-y-auto px-6 py-5">{children}</div>

        {/* Pie de acción */}
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-zinc-50/50 px-6 py-3.5">
            {typeof footer === "function" ? footer({ requestClose, close: requestClose }) : footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
