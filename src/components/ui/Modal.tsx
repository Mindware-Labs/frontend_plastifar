import { X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { createPortal } from "../../lib/portal";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useDialogMotion } from "../../hooks/useDialogMotion";
import { dialogHeaderShellMutedClass, dialogHeaderStackClass } from "./dialogHeaderStyles";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

const MODAL_SIZE_MAX_WIDTH: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-6xl",
  full: "max-w-[min(100%,72rem)]",
};

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
  /** Atajo de `maxWidth` usado en modales del producto. */
  size?: ModalSize;
  maxWidth?: string;
  /** Asentamiento del modal cuando el envío no prospera: baja 3px y vuelve. */
  settle?: boolean;
  /** Si es false, hacer clic en el telón de fondo no cierra el diálogo. Por defecto true. */
  closeOnBackdropClick?: boolean;
  /** Cabecera personalizada (reemplaza la cabecera por defecto). */
  header?: ReactNode | ((helpers: { requestClose: () => void }) => ReactNode);
  scrimClassName?: string;
  panelClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
}

/** Diálogo modal accesible con animación fluida y soporte para reducción de movimiento. */
export function Modal({
  title,
  eyebrow,
  description,
  onClose,
  footer,
  children,
  isExiting: externalIsExiting,
  onRequestClose: externalRequestClose,
  size,
  maxWidth,
  settle = false,
  closeOnBackdropClick = true,
  header,
  scrimClassName,
  panelClassName,
  bodyClassName,
  footerClassName,
}: ModalProps) {
  const motion = useDialogMotion(onClose, { exiting: externalIsExiting });
  const { isExiting, scrimRef, panelRef } = motion;
  const requestClose = externalRequestClose ?? motion.requestClose;

  const titleId = useId();
  const descriptionId = useId();

  const resolvedMaxWidth = maxWidth ?? (size ? MODAL_SIZE_MAX_WIDTH[size] : "max-w-lg");

  useDialogBehavior(panelRef, requestClose);

  const defaultBodyClass = "overflow-y-auto px-6 py-5 overscroll-contain";
  const defaultFooterClass =
    "flex shrink-0 items-center justify-end gap-2 border-t border-line bg-zinc-50/50 px-6 py-3.5";

  return createPortal(
    <div
      ref={scrimRef}
      inert={isExiting ? true : undefined}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-[2px] ${
        isExiting ? "pointer-events-none" : ""
      } ${scrimClassName ?? ""}`}
      onMouseDown={(event) => {
        if (closeOnBackdropClick && event.target === event.currentTarget && !isExiting) requestClose();
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
        } flex max-h-full w-full ${resolvedMaxWidth} flex-col overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-[0_12px_36px_rgba(27,27,29,0.14)] transition-[max-width] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${panelClassName ?? ""}`}
      >
        {(typeof header === "function" ? header({ requestClose }) : header) ?? (
          <div className={dialogHeaderShellMutedClass}>
            <div className={dialogHeaderStackClass}>
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
                className="animate-plf-header-fade font-heading text-[16px] font-bold leading-snug tracking-tight text-ink"
              >
                {title}
              </h2>
              {description && (
                <div
                  key={typeof description === "string" ? description : undefined}
                  id={descriptionId}
                  className="animate-plf-header-fade text-[12px] leading-relaxed text-subtle"
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
        )}

        <div className={bodyClassName ?? defaultBodyClass}>{children}</div>

        {footer && (
          <div className={footerClassName ?? defaultFooterClass}>
            {typeof footer === "function" ? footer({ requestClose, close: requestClose }) : footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
