import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useDialogMotion } from "../../hooks/useDialogMotion";
import { DIALOG_FOOTER, DIALOG_SCRIM, DialogHeader } from "./dialogParts";

export interface ModalHelpers {
  requestClose: () => void;
  close: () => void;
}

export type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-xl",
  xl: "max-w-2xl",
  "2xl": "max-w-3xl",
  /** Tablas editables a lo ancho: casi toda la ventana, con tope en pantallas enormes. */
  full: "max-w-[96vw] 2xl:max-w-[1720px]",
};

export interface ModalProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  /** Acciones del pie, separadas del cuerpo por un filete. */
  footer?: ReactNode | ((helpers: ModalHelpers) => ReactNode);
  children: ReactNode;
  /** Si el padre ya controla la animación de salida (ej: useModalAnimation) */
  isExiting?: boolean;
  onRequestClose?: () => void;
  /** Ancho del panel: sm 448, md 512 (por defecto), lg 576, xl 672, 2xl 768 px, full casi toda la ventana. */
  size?: ModalSize;
  /** Asentamiento del modal cuando el envío no prospera: baja 3px y vuelve. */
  settle?: boolean;
  /** Si es false, hacer clic en el telón de fondo no cierra el diálogo. Por defecto true. */
  closeOnBackdropClick?: boolean;
  /**
   * Cabecera propia en lugar de la estandar (visores, editores a pantalla completa). El dialogo
   * pasa a nombrarse con `aria-label={title}`; description se ignora.
   */
  header?: ReactNode | ((helpers: ModalHelpers) => ReactNode);
  /** Sustituye fondo y relleno del telon (por defecto velo con desenfoque y margen). */
  scrimClassName?: string;
  /** Sustituye ancho, alto, borde, radio y sombra del panel; `size` deja de aplicarse. */
  panelClassName?: string;
  /** Sustituye las clases del cuerpo (por defecto scroll con relleno). */
  bodyClassName?: string;
  /** Sustituye las clases del pie (por defecto acciones alineadas a la derecha). */
  footerClassName?: string;
}

/** Diálogo modal accesible con animación fluida y soporte para reducción de movimiento. */
export function Modal({
  title,
  description,
  onClose,
  footer,
  children,
  isExiting: externalIsExiting,
  onRequestClose: externalRequestClose,
  size = "md",
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

  useDialogBehavior(panelRef, requestClose);
  const helpers: ModalHelpers = { requestClose, close: requestClose };

  return createPortal(
    <div
      ref={scrimRef}
      inert={isExiting ? true : undefined}
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        scrimClassName ?? `${DIALOG_SCRIM} px-4 py-8`
      } ${
        isExiting ? "pointer-events-none" : ""
      }`}
      onMouseDown={(event) => {
        if (closeOnBackdropClick && event.target === event.currentTarget && !isExiting) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={header ? title : undefined}
        aria-labelledby={header ? undefined : titleId}
        aria-describedby={!header && description ? descriptionId : undefined}
        className={`${
          isExiting ? "pointer-events-none" : ""
        } ${
          settle ? "animate-plf-settle" : ""
        } flex flex-col ${
          panelClassName ??
          `max-h-full w-full ${sizeClasses[size]} overflow-hidden rounded-xl border border-line bg-white shadow-dialog transition-[max-width] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]`
        }`}
      >
        {header ? (
          typeof header === "function" ? header(helpers) : header
        ) : (
          <DialogHeader
            title={title}
            titleId={titleId}
            description={description}
            descriptionId={descriptionId}
            onClose={requestClose}
          />
        )}

        <div className={bodyClassName ?? "overflow-y-auto px-6 py-5"}>{children}</div>

        {footer && (
          <div className={footerClassName ?? DIALOG_FOOTER}>
            {typeof footer === "function" ? footer(helpers) : footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
