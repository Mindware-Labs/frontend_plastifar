import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useModalAnimation } from "../../hooks/useModalAnimation";

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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-[2px] ${
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
        } flex max-h-full w-full ${maxWidth} flex-col overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-xl`}
      >
        {/* Cabecera compacta */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="font-heading text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                {eyebrow}
              </p>
            )}
            <h2
              id={titleId}
              className="font-heading text-[15px] font-bold tracking-tight text-zinc-900 leading-snug"
            >
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={requestClose}
            aria-label="Cerrar"
            className="-mr-1 flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-all hover:bg-zinc-200/70 hover:text-zinc-800 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/20 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo del modal */}
        <div className="overflow-y-auto px-5 py-4">{children}</div>

        {/* Pie de acción */}
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/60 px-5 py-2.5">
            {typeof footer === "function" ? footer({ requestClose, close: requestClose }) : footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
