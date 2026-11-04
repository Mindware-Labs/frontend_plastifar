import { X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useDialogMotion } from "../../hooks/useDialogMotion";

export interface DrawerProps {
  title: string;
  /** Línea corta sobre el título: sitúa la acción dentro del módulo. */
  eyebrow?: string;
  description?: ReactNode;
  onClose: () => void;
  /** Acciones del pie, separadas del cuerpo por un filete. */
  footer?: ReactNode | ((helpers: { requestClose: () => void; close: () => void }) => ReactNode);
  children: ReactNode;
  maxWidth?: string;
  /** Si el padre ya controla la animación de salida */
  isExiting?: boolean;
  onRequestClose?: () => void;
  closeOnBackdropClick?: boolean;
}

/**
 * Panel lateral (Sheet). Mismo contrato y mismo comportamiento que `Modal` —portal
 * sobre document.body, Esc, trampa de foco, cierre suave con animación al pulsar
 * el velo o botón de salida— anclado al borde derecho y a la altura completa.
 */
export function Drawer({
  title,
  eyebrow,
  description,
  onClose,
  footer,
  children,
  maxWidth = "max-w-[460px]",
  isExiting: externalIsExiting,
  onRequestClose: externalRequestClose,
  closeOnBackdropClick = true,
}: DrawerProps) {
  const motion = useDialogMotion(onClose, { variant: "drawer", exiting: externalIsExiting });
  const { isExiting, requestClose, scrimRef, panelRef } = motion;
  const doRequestClose = externalRequestClose ?? requestClose;

  const titleId = useId();
  const descriptionId = useId();

  useDialogBehavior(panelRef, doRequestClose);

  return createPortal(
    <div
      ref={scrimRef}
      inert={isExiting ? true : undefined}
      className={`fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px] will-change-[opacity] ${
        isExiting ? "pointer-events-none" : ""
      }`}
      onMouseDown={(event) => {
        if (closeOnBackdropClick && event.target === event.currentTarget && !isExiting) {
          doRequestClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`m-2.5 flex h-[calc(100%-1.25rem)] w-full ${maxWidth}
          flex-col overflow-hidden rounded-card border border-line bg-white shadow-dialog will-change-[transform,opacity] ${
            isExiting ? "pointer-events-none" : ""
          }`}
      >
        <div className={`flex items-start justify-between gap-4 border-b border-line px-6 py-5`}>
          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
            {eyebrow && (
              <p className="font-heading text-[10px] font-medium uppercase tracking-[0.07em] text-faint">
                {eyebrow}
              </p>
            )}
            <h2
              id={titleId}
              className="font-heading text-[18px] font-semibold tracking-[-0.015em] text-ink"
            >
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-[12.5px] leading-relaxed text-subtle">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={doRequestClose}
            aria-label="Cerrar"
            className="-mr-1.5 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-edge
              text-subtle transition-colors hover:bg-fill hover:text-ink
              focus-visible:ring-3 focus-visible:ring-brand-red/20 outline-none cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line bg-fill px-6 py-3.5">
            {typeof footer === "function" ? footer({ requestClose: doRequestClose, close: onClose }) : footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
