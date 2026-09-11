import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useModalAnimation } from "../../hooks/useModalAnimation";

export interface ModalProps {
  title: string;
  /** Linea corta sobre el titulo: situa la accion dentro del modulo. */
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
}

/**
 * Dialogo modal del panel. Se monta en un portal sobre document.body para que
 * ningun ancestro con transform o overflow lo recorte ni lo desplace.
 * Cuenta con animación fluida de entrada (.animate-plf-modal-in) y de salida
 * (.animate-plf-modal-out) tanto en el panel como en el telón de fondo.
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
}: ModalProps) {
  const internal = useModalAnimation(onClose);
  const isExiting = externalIsExiting ?? internal.isExiting;
  const requestClose = externalRequestClose ?? internal.requestClose;

  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useDialogBehavior(panelRef, requestClose);

  return createPortal(
    <div
      inert={isExiting ? true : undefined}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4 py-8 ${
        isExiting ? "animate-plf-scrim-out pointer-events-none" : "animate-plf-scrim-in"
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
          isExiting ? "animate-plf-modal-out pointer-events-none" : "animate-plf-modal-in"
        } flex max-h-full w-full ${maxWidth} flex-col overflow-hidden rounded-edge border border-line bg-white shadow-[0_4px_10px_rgba(27,27,29,0.06),0_32px_64px_-28px_rgba(27,27,29,0.45)]`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
          <div>
            {eyebrow && (
              <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                {eyebrow}
              </p>
            )}
            <h2
              id={titleId}
              className="mt-1 font-heading text-[17px] font-bold tracking-[-0.01em] text-ink"
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
            onClick={requestClose}
            aria-label="Cerrar"
            className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-edge text-subtle
              transition-colors hover:bg-fill hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-line bg-canvas px-6 py-3.5">
            {typeof footer === "function" ? footer({ requestClose, close: requestClose }) : footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
