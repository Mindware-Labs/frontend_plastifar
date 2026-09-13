import { useEffect, useRef, type RefObject } from "react";

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Conducta comun de los dialogos: fondo bloqueado, Escape, foco atrapado y devuelto al cerrar. */
export function useDialogBehavior(panelRef: RefObject<HTMLElement | null>, onClose: () => void) {
  // El efecto no debe depender de onClose: si el padre la recrea en cada render,
  // se reiniciaria y devolveria el foco al primer campo en mitad del tecleo.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    /*
     * El foco entra al primer CAMPO, no al aspa: se llega a escribir de
     * inmediato.
     *
     * `[role=combobox]` entra en la lista porque los desplegables de la casa no
     * son un `<select>` nativo sino un boton con ese rol. Sin el, un formulario
     * que empieza con un desplegable —«Nuevo ticket»— no encontraba ningun
     * campo, caia al respaldo «primer boton del panel» y aterrizaba en Cerrar:
     * se abria el dialogo para crear algo y el teclado empezaba sobre la accion
     * de abandonarlo. Medido, no supuesto.
     *
     * El respaldo tambien excluye el aspa por el mismo motivo.
     */
    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>(
      "input:not([type='hidden']):not([data-skip-autofocus]), select, textarea, [role='combobox']",
    );
    const fallback = panel?.querySelector<HTMLElement>(
      "button:not([aria-label='Cerrar']):not([data-skip-autofocus])",
    );
    (firstField ?? fallback ?? panel?.querySelector<HTMLElement>("button"))?.focus();

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
  }, [panelRef]);
}
