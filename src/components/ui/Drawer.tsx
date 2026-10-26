import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useDialogMotion } from "../../hooks/useDialogMotion";

export interface DrawerHelpers {
  /** Cierra respetando la salida animada cuando la hay. */
  requestClose: () => void;
}

interface DrawerProps {
  title: string;
  /** Linea corta sobre el titulo: situa la accion dentro del modulo. */
  eyebrow?: string;
  description?: ReactNode;
  onClose: () => void;
  /** Acciones del pie, separadas del cuerpo por un filete. */
  footer?: ReactNode | ((helpers: DrawerHelpers) => ReactNode);
  children: ReactNode;
  maxWidth?: string;
  /**
   * Entrada y salida coordinadas por useDialogMotion, como `Modal`: el panel se retira
   * deslizandose y `onClose` llega al terminar. Sin ella, desmonte en seco como siempre.
   */
  animated?: boolean;
  /** Salida gobernada por el padre (ej: useModalAnimation). Implica `animated`. */
  isExiting?: boolean;
  onRequestClose?: () => void;
  /**
   * Cabecera propia en lugar de la estandar. El dialogo pasa a nombrarse con
   * `aria-label={title}`; eyebrow y description se ignoran.
   */
  header?: ReactNode | ((helpers: DrawerHelpers) => ReactNode);
  /** Sustituye ancho, alto, margen, borde, radio y sombra del panel; `maxWidth` deja de aplicarse. */
  panelClassName?: string;
  /** Sustituye las clases del cuerpo (por defecto scroll con relleno). */
  bodyClassName?: string;
  /** Sustituye las clases del pie (por defecto acciones a la derecha sobre fondo gris). */
  footerClassName?: string;
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
export function Drawer({
  title,
  eyebrow,
  description,
  onClose,
  footer,
  children,
  maxWidth = "max-w-[460px]",
  animated: animatedProp = false,
  isExiting: externalIsExiting,
  onRequestClose: externalRequestClose,
  header,
  panelClassName,
  bodyClassName,
  footerClassName,
}: DrawerProps) {
  const animated = animatedProp || externalIsExiting !== undefined;
  const staticPanelRef = useRef<HTMLDivElement>(null);
  const motion = useDialogMotion(onClose, { variant: "drawer", exiting: externalIsExiting });
  // Sin animacion las refs del movimiento no se enganchan y el hook no hace nada.
  const panelRef = animated ? motion.panelRef : staticPanelRef;
  const isExiting = animated && motion.isExiting;
  const requestClose = animated ? (externalRequestClose ?? motion.requestClose) : onClose;
  const helpers: DrawerHelpers = { requestClose };
  const titleId = useId();
  const descriptionId = useId();

  useDialogBehavior(panelRef, requestClose);

  return createPortal(
    <div
      ref={animated ? motion.scrimRef : undefined}
      inert={isExiting ? true : undefined}
      className={
        animated
          ? `fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px] ${
              isExiting ? "pointer-events-none" : ""
            }`
          : "animate-plf-scrim-in fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px]"
      }
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isExiting) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={header ? title : undefined}
        aria-labelledby={header ? undefined : titleId}
        aria-describedby={!header && description ? descriptionId : undefined}
        /* Panel flotante y no pared: separado del borde por un margen y con
           radio completo, igual que el carril lateral y las tarjetas. Pegado al
           canto derecho, el drawer era la unica superficie del sistema que
           todavia se comportaba como un bloque de cromo.

           El `border-l` se fue con el mismo argumento que en el carril: un
           borde de un solo lado contra una esquina redondeada deja muesca. */
        className={`${animated ? "" : "animate-plf-drawer-in"} flex flex-col ${
          panelClassName ??
          `m-2.5 h-[calc(100%-1.25rem)] w-full ${maxWidth} overflow-hidden rounded-card border border-line bg-white shadow-dialog`
        } ${isExiting ? "pointer-events-none" : ""}`}
      >
        {header ? (
          typeof header === "function" ? header(helpers) : header
        ) : (
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
              onClick={requestClose}
              aria-label="Cerrar"
              className="-mr-1.5 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-edge
                text-subtle transition-colors hover:bg-fill hover:text-ink
                focus-visible:ring-3 focus-visible:ring-brand-red/20 outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className={bodyClassName ?? "flex-1 overflow-y-auto px-6 py-5"}>{children}</div>

        {footer && (
          <div
            className={
              footerClassName ??
              "flex shrink-0 flex-wrap justify-end gap-2 border-t border-line bg-fill px-6 py-3.5"
            }
          >
            {typeof footer === "function" ? footer(helpers) : footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
