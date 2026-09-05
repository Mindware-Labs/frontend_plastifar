import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  /** Acciones del pie, separadas del cuerpo por un filete. */
  footer?: ReactNode;
  children: ReactNode;
}

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialogo modal del panel. Se monta en un portal sobre document.body para que
 * ningun ancestro con transform o overflow lo recorte ni lo desplace.
 */
export function Modal({ title, description, onClose, footer, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // El efecto de montaje no debe depender de onClose: si el padre recrea esa
  // funcion en cada render, el efecto se reiniciaria y devolveria el foco al
  // primer campo en mitad del tecleo.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // El foco entra al primer campo, no al aspa: se llega a escribir de inmediato.
    // El Select del panel es un <button role="combobox">, no un <select>, asi que
    // sin [role="combobox"] un dialogo que empieza por un desplegable enfocaba el
    // aspa. Se excluye lo deshabilitado: focus() sobre un campo apagado no hace
    // nada y el dialogo se quedaba sin foco inicial.
    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>(
      "input:not([type='hidden']):not([disabled]), textarea:not([disabled]), [role='combobox']:not([disabled])",
    );
    (firstField ?? panel?.querySelector<HTMLElement>("button"))?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      // Trampa de foco: el tabulador no debe escaparse al fondo de la pagina.
      // Hueco conocido: solo recorre los descendientes del panel, y Select dibuja
      // su listbox en un portal colgado de document.body. Con la lista abierta sus
      // opciones quedan fuera de la trampa. No es urgente porque el listbox se
      // maneja con flechas y cierra con Tab, pero si algun dia un portal necesita
      // recorrido propio, hay que registrarlo aqui en vez de ampliar el selector.
      const items = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus();
    };
  }, []);

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
          rounded-edge border border-line bg-white shadow-dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
          <div className="flex flex-col gap-1">
            <h2
              id={titleId}
              className="font-heading text-[17px] font-bold tracking-[-0.01em] text-ink"
            >
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-[12.5px] leading-relaxed text-muted">
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
