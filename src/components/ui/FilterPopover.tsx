import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const ANCHO = 332;
/** Margen contra el borde inferior de la ventana antes de que el panel scrollee. */
const AIRE = 24;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Los criterios que acotan un listado, guardados hasta que hacen falta.
 *
 * ==================================================================
 * POR QUÉ SE ESCONDEN
 * ==================================================================
 * Medido antes de tocar nada: la barra de Solicitudes de crédito ocupaba 119 px
 * en tres renglones con nueve controles, y la de HCA otros 119 con siete. La de
 * Tickets, con ocho controles, cabía en 57 px de un solo renglón — porque los
 * secundarios ya vivían detrás de un botón.
 *
 * La diferencia no es cuántos criterios existen, sino cuántos se miran. De los
 * siete de HCA, quien abre la pantalla usa el buscador y las pastillas; «línea
 * de producto» y «responsable» se tocan cuando se busca algo concreto. Tenerlos
 * siempre desplegados cobra espacio a la tabla —lo único que se vino a leer—
 * para ahorrar un clic que casi nadie da.
 *
 * ==================================================================
 * ESCONDER NO ES OCULTAR
 * ==================================================================
 * La diferencia está en el contador del disparador. Un filtro aplicado que no
 * se ve es la peor avería posible de un listado: la persona lee una tabla
 * recortada creyendo que es la tabla entera, y nada en pantalla la contradice.
 *
 * Por eso el botón dice cuántos criterios hay puestos, se marca con el rojo de
 * estado activo, y el panel trae su propio «Quitar». Mientras haya un número
 * ahí, la pantalla está diciendo que lo que se ve está recortado.
 *
 * ==================================================================
 * ES UN DIÁLOGO, Y SE COMPORTA COMO TAL
 * ==================================================================
 * La primera versión anunciaba `role="dialog"` y no cumplía nada de lo que eso
 * promete: al abrirlo el foco se quedaba fuera, y el primer tabulador lo sacaba
 * a navegar la página de detrás. Medido, no supuesto.
 *
 * Ahora el foco entra al primer control, queda atrapado mientras está abierto y
 * vuelve al botón al cerrar. Es el mismo contrato que cumplen los diálogos del
 * resto del panel.
 */
export function FilterPopover({
  count,
  onClear,
  children,
  label = "Filtros",
}: {
  /** Cuántos de los criterios de dentro están puestos. 0 = ninguno. */
  count: number;
  /** Quita sólo los criterios de este panel, no la búsqueda ni las pastillas. */
  onClear: () => void;
  children: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number; maxHeight: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    /* El foco entra al primer CRITERIO, no al aspa.
       Buscarlo en el panel entero devolvia el boton de cerrar, porque vive en
       la cabecera y va antes en el DOM: se abria el panel para filtrar y el
       teclado aterrizaba en «cerrar», que es la accion contraria. Se busca
       dentro del cuerpo, que es donde estan los criterios. */
    const panel = panelRef.current;
    const primero = bodyRef.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, [role="combobox"], button',
    );
    primero?.focus();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      /* Trampa de foco. Sin esto el tabulador se iba a la página de detrás:
         quien navega con teclado abría los filtros y acababa recorriendo el
         carril lateral sin haber cerrado nada. */
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const primeroFoco = items[0];
      const ultimo = items[items.length - 1];

      if (event.shiftKey && document.activeElement === primeroFoco) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primeroFoco.focus();
      }
    }

    /* Posición fija: si la página se mueve debajo, el panel deja de estar donde
       lo abrieron. Cerrarlo es más honesto que dejarlo flotando lejos. */
    function handleViewportChange() {
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [open]);

  function cerrar() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function toggle() {
    if (open) {
      cerrar();
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const top = rect.bottom + 6;
    setAnchor({
      top,
      // Anclado a la derecha del botón, y nunca fuera de la ventana.
      left: Math.max(8, Math.min(rect.right - ANCHO, window.innerWidth - ANCHO - 8)),
      /* Con seis criterios en una ventana de portátil, el panel se salía por
         abajo y el último campo quedaba fuera de alcance. Ahora se acota al
         hueco que hay y scrollea por dentro. */
      maxHeight: Math.max(200, window.innerHeight - top - AIRE),
    });
    setOpen(true);
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={count > 0 ? `${label}: ${count} aplicados` : label}
        data-active={count > 0}
        className="flex h-8 items-center gap-1.5 rounded-edge border border-line-strong bg-white px-2.5
          text-[12.5px] font-medium text-brand-gray outline-none transition-all duration-150
          hover:border-hairline-hover hover:text-ink active:scale-[0.97]
          focus-visible:border-brand-red focus-visible:ring-3 focus-visible:ring-brand-red/10
          data-[active=true]:border-brand-red/40 data-[active=true]:text-brand-red-dark
          aria-expanded:bg-fill aria-expanded:text-ink"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {label}
        {/* La cifra, no un punto: «hay filtros» obliga a abrir para saber
            cuántos; «2» ya lo dice desde fuera. */}
        {count > 0 && (
          <span className="ml-0.5 rounded-pill bg-brand-red/10 px-1.5 text-[11px] font-semibold tabular-nums text-brand-red-dark">
            {count}
          </span>
        )}
      </button>

      {open &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            style={{ position: "fixed", top: anchor.top, left: anchor.left, width: ANCHO }}
            className="animate-plf-popover-in z-[60] flex flex-col overflow-hidden rounded-card
              border border-line bg-white shadow-dialog"
          >
            {/* Cabecera: el panel abría directamente con «LÍNEA» y nada decía
                qué era esto ni cuánto había puesto. */}
            <div className="flex shrink-0 items-center gap-2 border-b border-line-soft px-3.5 py-2.5">
              <h2
                id={titleId}
                className="font-heading text-[10px] font-semibold uppercase tracking-[0.07em] text-faint"
              >
                {label}
              </h2>
              {count > 0 && (
                <span className="text-[11.5px] tabular-nums text-subtle">
                  {count} {count === 1 ? "aplicado" : "aplicados"}
                </span>
              )}
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar filtros"
                className="-mr-1 ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-edge
                  text-subtle outline-none transition-colors hover:bg-fill hover:text-ink
                  focus-visible:ring-3 focus-visible:ring-brand-red/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div
              ref={bodyRef}
              style={{ maxHeight: anchor.maxHeight }}
              className="flex flex-col gap-3 overflow-y-auto px-3.5 py-3.5"
            >
              {children}
            </div>

            {/* El pie sólo existe cuando hay algo que quitar: un botón apagado
                permanente ocupa sitio para no hacer nada. */}
            {count > 0 && (
              <div className="shrink-0 border-t border-line-soft bg-fill px-3.5 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    cerrar();
                  }}
                  className="rounded-edge text-[12px] font-medium text-brand-red-dark
                    underline-offset-2 outline-none hover:underline
                    focus-visible:ring-3 focus-visible:ring-brand-red/20"
                >
                  Quitar {count === 1 ? "el filtro" : `los ${count} filtros`}
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
