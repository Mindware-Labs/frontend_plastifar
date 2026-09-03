import {
  BarChart3,
  Building2,
  ChevronDown,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { REPORT_FAMILIES } from "../../types/reports";
import { Logo } from "../Logo";

interface ModuleLink {
  label: string;
  to: string;
}

interface ModuleEntry {
  label: string;
  icon: typeof Users;
  to: string;
  match: string[];
  /** Rutas estaticas del modulo. Todas viven aqui, no como pestanas dentro
   *  de la vista — lo unico que se queda en la vista es la navegacion que
   *  depende de un id (la ficha de un registro concreto). */
  children?: ModuleLink[];
}

const modules: ModuleEntry[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard", match: ["/dashboard"] },
  {
    label: "Personal",
    icon: Users,
    to: "/staff",
    match: ["/staff", "/roles", "/permisos"],
    children: [
      { label: "Colaboradores", to: "/staff" },
      { label: "Roles", to: "/roles" },
      { label: "Permisos", to: "/permisos" },
    ],
  },
  { label: "Clientes", icon: Building2, to: "/clientes", match: ["/clientes"] },
  {
    label: "Reportes",
    icon: BarChart3,
    to: REPORT_FAMILIES[0].to,
    match: ["/reportes"],
    children: REPORT_FAMILIES.map(({ label, to }) => ({ label, to })),
  },
  {
    label: "Configuración",
    icon: Settings,
    to: "/configuracion/motivos",
    match: ["/configuracion"],
    children: [
      { label: "Motivos", to: "/configuracion/motivos" },
      { label: "SLA", to: "/configuracion/sla" },
      { label: "Días no laborables", to: "/configuracion/feriados" },
      { label: "Líneas de producto", to: "/configuracion/lineas" },
      { label: "Plantillas", to: "/configuracion/plantillas" },
      { label: "Buzones", to: "/configuracion/buzones" },
      { label: "Territorios", to: "/configuracion/territorios" },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Solo aplica por debajo de lg: el panel se desliza sobre el contenido. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

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
   *  el sidebar compite por ancho con el contenido, y en movil es superpuesto.
   *  En modo icono no se listan las rutas hijas: no hay espacio para el
   *  texto, así que ese estado es solo un atajo al primer nivel. */
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
          {modules.map((module) => {
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
          <aside className="animate-plf-modal-in absolute inset-y-0 left-0 flex w-[240px] flex-col bg-white shadow-[0_4px_10px_rgba(27,27,29,0.06),0_32px_64px_-28px_rgba(27,27,29,0.45)]">
            {renderContent(false)}
          </aside>
        </div>
      )}
    </>
  );
}
