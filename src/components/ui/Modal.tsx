import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";

interface ModalProps {
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
 * Dialogo modal del panel. Se monta en un portal sobre document.body para que
 * ningun ancestro con transform o overflow lo recorte ni lo desplace.
 */
export function Modal({ title, eyebrow, description, onClose, footer, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useDialogBehavior(panelRef, onClose);

  return createPortal(
    <div
      className="animate-plf-scrim-in fixed inset-0 z-50 flex items-center justify-center
        bg-ink/45 px-4 py-8 backdrop-blur-[2px]"
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
        className="animate-plf-modal-in flex max-h-full w-full max-w-lg flex-col overflow-hidden
          rounded-edge border border-line bg-white
          shadow-[0_4px_10px_rgba(27,27,29,0.06),0_32px_64px_-28px_rgba(27,27,29,0.45)]"
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
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-edge text-muted
              transition-colors hover:bg-fill hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-line bg-canvas px-6 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
