import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

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

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, eyebrow, description, onClose, footer, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

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
    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>(
      "input:not([type='hidden']), select, textarea",
    );
    (firstField ?? panel?.querySelector<HTMLElement>("button"))?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      // Trampa de foco: el tabulador no debe escaparse al fondo de la pagina.
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

  return (
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
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{description}</p>
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
    </div>
  );
}
