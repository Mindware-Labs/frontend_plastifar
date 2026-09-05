import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { SIDEBAR_NAV } from "../../lib/navigation";
import { Logo } from "../Logo";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Solo aplica por debajo de lg: el panel se desliza sobre el contenido. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

/** Mismo recorrido que la trampa de foco de Modal, para no divergir del kit. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Navegacion completa del panel: los modulos y, para los que tienen catalogo
 * o familia de secciones, sus rutas hijas tambien — todo en un solo arbol,
 * nada de eso vive ya como pestanas dentro de la vista.
 */
export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const { pathname } = useLocation();
  // Solo guarda los toggles explicitos de la persona; sin uno, un grupo esta
  // abierto si su modulo esta activo — derivado en el render, no en un
  // efecto, para no encadenar otro renderizado por cada cambio de ruta.
  const [expandedOverride, setExpandedOverride] = useState<Record<string, boolean>>({});
  const mobilePanelRef = useRef<HTMLElement>(null);

  // onCloseMobile suele ser una flecha nueva en cada render: se lee por ref para
  // que el efecto no se reinicie y vuelva a mover el foco al primer enlace.
  const closeRef = useRef(onCloseMobile);
  useEffect(() => {
    closeRef.current = onCloseMobile;
  });

  // El panel movil se anuncia como dialogo (mismo scrim y misma sombra que
  // Modal), asi que debe comportarse como uno: el foco entra, no se escapa con
  // el tabulador, la pagina de debajo no hace scroll y al cerrar el foco vuelve
  // al boton de menu. Sin esto, en ancho de telefono el teclado se quedaba
  // atrapado en una barra superior que el scrim ya habia tapado.
  useEffect(() => {
    if (!mobileOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = mobilePanelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
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
  }, [mobileOpen]);

  /** El panel movil siempre va expandido: colapsar solo tiene sentido cuando
   *  el sidebar compite por ancho con el contenido, y en movil es superpuesto.
   *  En modo icono no se listan las rutas hijas: no hay espacio para el
   *  texto, así que ese estado es solo un atajo al primer nivel. */
  function renderContent(isCollapsed: boolean, withCollapseToggle = true) {
    return (
      <>
        <div
          className={`flex h-16 shrink-0 items-center border-b border-line px-4 ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!isCollapsed && <Logo variant="color" height={24} />}
          {/* En el panel movil no se dibuja: esta oculto por CSS y un boton
              invisible dentro de la trampa de foco es una parada muerta. */}
          {withCollapseToggle && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Expandir menú" : "Contraer menú"}
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-edge text-faint
              outline-none transition-colors hover:bg-fill hover:text-ink focus-visible:ring-3
              focus-visible:ring-brand-red/25 lg:flex"
          >
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2.5">
          {SIDEBAR_NAV.map((module) => {
            const { label, icon: Icon, to, match, children } = module;
            const isActive = match.some((path) => pathname.startsWith(path));
            const isOpen =
              !isCollapsed && Boolean(children) && (expandedOverride[label] ?? isActive);

            return (
              <div key={label}>
                <div className={`flex items-center ${isCollapsed ? "" : "pr-1"}`}>
                  <NavLink
                    to={to}
                    onClick={onCloseMobile}
                    title={isCollapsed ? label : undefined}
                    className={`flex h-10 flex-1 items-center gap-3 rounded-edge border-l-2 px-3 text-[13.5px]
                      outline-none transition-colors focus-visible:ring-3 focus-visible:ring-brand-red/25
                      ${isCollapsed ? "justify-center px-0" : ""} ${
                        isActive
                          ? "border-brand-red bg-brand-red/[0.04] font-semibold text-ink"
                          : "border-transparent font-medium text-muted hover:bg-fill hover:text-ink"
                      }`}
                  >
                    <Icon className="h-[17px] w-[17px] shrink-0" />
                    {!isCollapsed && <span className="truncate">{label}</span>}
                  </NavLink>

                  {!isCollapsed && children && (
                    <button
                      type="button"
                      onClick={() => setExpandedOverride((previous) => ({ ...previous, [label]: !isOpen }))}
                      aria-label={isOpen ? `Contraer ${label}` : `Expandir ${label}`}
                      aria-expanded={isOpen}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-edge text-faint
                        outline-none transition-colors hover:bg-fill hover:text-ink focus-visible:ring-3
                        focus-visible:ring-brand-red/25"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="ml-[26px] mt-0.5 flex flex-col gap-0.5 border-l border-line pl-3.5">
                    {children!.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end
                        onClick={onCloseMobile}
                        className={({ isActive: childActive }) =>
                          `flex h-8 items-center truncate rounded-edge px-2.5 text-[12.5px] outline-none
                          transition-colors focus-visible:ring-3 focus-visible:ring-brand-red/25 ${
                            childActive
                              ? "font-semibold text-brand-red"
                              : "font-medium text-muted hover:bg-fill hover:text-ink"
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </>
    );
  }

  return (
    <>
      {/* Escritorio: parte del flujo, siempre visible. */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-line bg-white transition-[width] duration-200
          lg:flex ${collapsed ? "w-16" : "w-[220px]"}`}
      >
        {renderContent(collapsed)}
      </aside>

      {/* Movil: panel superpuesto con scrim, igual vocabulario que Modal. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            aria-hidden
            onClick={onCloseMobile}
            className="animate-plf-scrim-in absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
          />
          <aside
            ref={mobilePanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Módulos"
            className="animate-plf-modal-in absolute inset-y-0 left-0 flex w-[240px] flex-col bg-white shadow-dialog"
          >
            {renderContent(false, false)}
          </aside>
        </div>
      )}
    </>
  );
}
