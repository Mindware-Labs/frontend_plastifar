import { BarChart3, Building2, PanelLeftClose, PanelLeftOpen, Settings, Users } from "lucide-react";
import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Logo } from "../Logo";

const modules = [
  { label: "Personal", icon: Users, to: "/staff", match: ["/staff", "/roles", "/permisos"] },
  { label: "Clientes", icon: Building2, to: "/clientes", match: ["/clientes"] },
  { label: "Reportes", icon: BarChart3, to: "/reportes", match: ["/reportes"] },
  { label: "Configuración", icon: Settings, to: "/configuracion", match: ["/configuracion"] },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Solo aplica por debajo de lg: el panel se desliza sobre el contenido. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

/**
 * Navegacion de modulos, ahora vertical. Sustituye a la barra horizontal de
 * pestanas: mismos cuatro modulos, mismos iconos, mismo criterio de estado
 * activo — solo cambia el eje. Cada modulo conserva sus propias pestanas de
 * seccion dentro de su ModuleHeader, sin tocar.
 */
export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const { pathname } = useLocation();

  // Mismo contrato de teclado que Modal: Escape cierra el panel superpuesto.
  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseMobile();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  /** El panel movil siempre va expandido: colapsar solo tiene sentido cuando
   *  el sidebar compite por ancho con el contenido, y en movil es superpuesto. */
  function renderContent(isCollapsed: boolean) {
    return (
      <>
        <div
          className={`flex h-16 shrink-0 items-center border-b border-line px-4 ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!isCollapsed && <Logo variant="color" height={24} />}
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
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2.5">
          {modules.map(({ label, icon: Icon, to, match }) => {
            const isActive = match.some((path) => pathname.startsWith(path));

            return (
              <NavLink
                key={label}
                to={to}
                onClick={onCloseMobile}
                title={isCollapsed ? label : undefined}
                className={`flex h-10 items-center gap-3 rounded-edge border-l-2 px-3 text-[13.5px]
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
          <aside className="animate-plf-modal-in absolute inset-y-0 left-0 flex w-[240px] flex-col bg-white shadow-[0_4px_10px_rgba(27,27,29,0.06),0_32px_64px_-28px_rgba(27,27,29,0.45)]">
            {renderContent(false)}
          </aside>
        </div>
      )}
    </>
  );
}
