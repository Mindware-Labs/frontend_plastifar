import { useEffect, useRef, type RefObject } from "react";
import { openOverlay } from "./overlayStack";

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Conducta comun de los dialogos: fondo bloqueado, Escape, foco atrapado y devuelto al cerrar. */
export function useDialogBehavior(panelRef: RefObject<HTMLElement | null>, onClose: () => void) {
  // Estabiliza referencias de cierre para evitar reinicios de foco.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const overlay = openOverlay();
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // El foco entra al primer campo, no al aspa: se llega a escribir de inmediato.
    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>(
      "input:not([type='hidden']):not([data-skip-autofocus]), select, textarea",
    );
    (firstField ?? panel?.querySelector<HTMLElement>("button"))?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (overlay.isTop()) closeRef.current();
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
      overlay.close();
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      // Solo restaurar el foco al elemento anterior si el diálogo realmente se
      // desmontó del DOM. En desarrollo (React StrictMode) el efecto se ejecuta
      // dos veces: restaurar el foco sincrónicamente provoca un evento blur prematuro
      // en el primer campo, disparando errores de validación nada más abrir la modal.
      requestAnimationFrame(() => {
        if (!panel || !document.contains(panel)) {
          previouslyFocused?.focus();
        }
      });
    };
  }, [panelRef]);
}
