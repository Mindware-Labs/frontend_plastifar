import {
  BarChart3,
  Building2,
  ChevronDown,
  ClipboardCheck,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Settings,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useEmailCounts } from "../../context/useEmailCounts";
import { usePermissions } from "../../hooks/usePermissions";
import type { PermissionKey } from "../../lib/permissions";
import type { EmailFolderCounts } from "../../types/api";
import { Logo } from "../Logo";
import { ChangePasswordModal } from "./ChangePasswordModal";

interface NavItem {
  label: string;
  to: string;
  /** Coincidencia exacta: sin esto, "/bandeja" quedaria activo tambien en "/bandeja/junk". */
  end?: boolean;
  /** Carpeta de correo cuyo contador se pinta al final del renglon. */
  folder?: keyof EmailFolderCounts;
  /** Permiso que exige la ruta. Ausente = abierta a todo el personal. */
  permission?: PermissionKey;
}

interface NavGroup {
  label: string;
  icon: typeof Inbox;
  /** Un item propio (Bandeja) o una familia de sub-secciones (Personal). */
  to?: string;
  children?: NavItem[];
  permission?: PermissionKey;
}

/**
 * Arbol de navegacion del panel: los modulos nuevos entran aqui sin tocar el
 * layout.
 *
 * Cada entrada declara el mismo permiso que su ruta en App.tsx. RF-P6 pide que
 * la interfaz oculte lo que la persona no puede hacer, y un enlace de modulo es
 * exactamente eso: sin el filtro, alguien sin clients.read veia Clientes en el
 * menu y descubria el bloqueo al entrar.
 *
 * Dashboard y Configuracion no llevan permiso a proposito, igual que sus rutas:
 * la seccion 8.4 abre la lectura de catalogos a todo el personal autenticado.
 */
const groups: NavGroup[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  {
    label: "Correo",
    icon: Inbox,
    permission: "tickets.read",
    children: [
      { label: "Bandeja", to: "/bandeja", end: true, folder: "inbox" },
      { label: "Archivados", to: "/bandeja/archivados", folder: "archived" },
      { label: "No deseado", to: "/bandeja/junk", folder: "junk" },
      { label: "Papelera", to: "/bandeja/papelera", folder: "trash" },
    ],
  },
  {
    label: "Personal",
    icon: Users,
    children: [
      { label: "Colaboradores", to: "/staff", permission: "staff.read" },
      { label: "Roles", to: "/roles", permission: "roles.read" },
      { label: "Permisos", to: "/permisos", permission: "roles.read" },
    ],
  },
  { label: "Clientes", icon: Building2, to: "/clientes", permission: "clients.read" },
  {
    label: "Calidad",
    icon: ClipboardCheck,
    permission: "quality.read",
    children: [
      { label: "HCA", to: "/calidad/hca" },
      { label: "Solicitudes de crédito", to: "/calidad/creditos" },
    ],
  },
  {
    label: "Reportes",
    icon: BarChart3,
    permission: "reports.read",
    children: [
      { label: "Operación en vivo", to: "/reportes/operacion" },
      { label: "SLA y tiempos", to: "/reportes/sla" },
      { label: "Productividad", to: "/reportes/productividad" },
      { label: "Calidad", to: "/reportes/calidad" },
      { label: "Clientes", to: "/reportes/clientes" },
      { label: "Volumen", to: "/reportes/volumen" },
      { label: "Auditoría", to: "/reportes/auditoria" },
    ],
  },
  {
    label: "Configuración",
    icon: Settings,
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

/** Panel de hijos anclado al icono: se posiciona fijo para que el riel no lo recorte. */
interface Flyout {
  group: NavGroup;
  top: number;
  left: number;
}

const linkBase =
  "flex items-center gap-2.5 rounded-edge px-3 py-2 text-[13px] font-medium transition-colors";

/** Sin leer manda en rojo; si todo esta leido, el total queda en gris de apoyo. */
function FolderBadge({ count }: { count: { total: number; unread: number } }) {
  if (count.unread > 0) {
    return (
      <span
        className="ml-auto flex h-[18px] min-w-[18px] shrink-0 items-center justify-center
          rounded-full bg-brand-red px-1.5 font-heading text-[10.5px] font-bold tabular-nums
          text-white shadow-[0_2px_6px_-2px_rgba(228,0,43,0.6)]"
      >
        {count.unread > 99 ? "99+" : count.unread}
      </span>
    );
  }

  if (count.total === 0) return null;

  return (
    <span className="ml-auto shrink-0 text-[11px] font-medium tabular-nums text-faint">
      {count.total}
    </span>
  );
}
const linkInactive = "text-brand-gray hover:bg-fill hover:text-ink";
const linkActive = "bg-brand-red/8 font-semibold text-brand-red-dark";

/** Icono suelto de la barra contraida. */
const railBase = "flex h-9 w-9 shrink-0 items-center justify-center rounded-edge transition-colors";

const collapsedKey = "plf.sidebar-collapsed";

/** En navegacion privada leer localStorage lanza: la barra abre expandida. */
function readCollapsed() {
  try {
    return localStorage.getItem(collapsedKey) === "1";
  } catch {
    return false;
  }
}

/** Barra lateral: logotipo, arbol de modulos y, al pie, la persona conectada. */
export function Sidebar() {
  const { user, logout } = useAuth();
  const { counts } = useEmailCounts();
  const { can } = usePermissions();

  /**
   * Menu recortado a lo que la persona puede abrir (RF-P6).
   *
   * Un grupo sobrevive si el suyo pasa y le queda al menos un hijo visible: sin
   * esa segunda condicion, alguien con roles.read pero sin staff.read veia el
   * grupo Personal con la lista vacia, que es peor que no verlo.
   */
  const visibleGroups = useMemo(
    () =>
      groups
        .filter((group) => !group.permission || can(group.permission))
        .map((group) => ({
          ...group,
          children: group.children?.filter((child) => !child.permission || can(child.permission)),
        }))
        .filter((group) => !group.children || group.children.length > 0),
    [can],
  );
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [flyout, setFlyout] = useState<Flyout | null>(null);
  /** Solo los grupos que la persona abrio o cerro a mano; el resto sale de la ruta. */
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!flyout) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFlyout(null);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [flyout]);

  useEffect(() => () => cancelClose(), []);

  function cancelClose() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function openFlyout(group: NavGroup, anchor: HTMLElement) {
    if (!group.children) return;
    cancelClose();
    const rect = anchor.getBoundingClientRect();
    setFlyout({ group, top: rect.top - 6, left: rect.right + 8 });
  }

  /** Retardo corto: da tiempo a cruzar el hueco entre el icono y el panel. */
  function scheduleClose() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setFlyout(null), 140);
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    setMenuOpen(false);
    setFlyout(null);
    try {
      localStorage.setItem(collapsedKey, next ? "1" : "0");
    } catch {
      // Sin almacenamiento la barra funciona igual, solo no recuerda el estado.
    }
  }

  /** Contraida no se ven los hijos: el icono se enciende con cualquier ruta del grupo. */
  function isGroupActive(group: NavGroup) {
    const targets = group.children?.map((child) => child.to) ?? [group.to!];
    return targets.some((to) => pathname === to || pathname.startsWith(`${to}/`));
  }

  /**
   * Un grupo abierto se deriva de la ruta, no de un efecto: entrar a
   * /calidad/hca abre Calidad sin que nadie lo pulse. El mapa solo guarda las
   * veces que la persona contradijo esa regla a mano, y esa decision manda
   * mientras dure la sesion.
   *
   * Derivado y no efectuado a proposito: con un useEffect que "abriera al
   * navegar", el grupo se reabriria solo cada vez que la ruta cambia, pisando
   * al que lo cerro hace un segundo.
   */
  function isGroupOpen(group: NavGroup) {
    return manualOpen[group.label] ?? isGroupActive(group);
  }

  function toggleGroup(group: NavGroup) {
    setManualOpen((current) => ({ ...current, [group.label]: !isGroupOpen(group) }));
  }

  const local = user?.email.split("@")[0] ?? "";
  const initials = local.slice(0, 2).toUpperCase() || "PF";
  const pendingMail = counts
    ? counts.inbox.unread + counts.archived.unread + counts.junk.unread + counts.trash.unread
    : 0;

  return (
    <aside
      className={`flex h-screen shrink-0 flex-col border-r border-line bg-white
        transition-[width] duration-200 ease-out ${collapsed ? "w-[68px]" : "w-60"}`}
    >
      <div
        className={`flex h-16 shrink-0 items-center ${
          collapsed ? "justify-center px-2" : "justify-between px-5"
        }`}
      >
        {!collapsed && <Logo height={22} />}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir la barra lateral" : "Contraer la barra lateral"}
          title={collapsed ? "Expandir" : "Contraer"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-edge text-faint
            transition-colors hover:bg-fill hover:text-ink"
        >
          <PanelLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Aire entre modulos: sin el, siete grupos y sus hijos se leen como una
          sola lista larga y cuesta ver donde termina uno y empieza el otro.
          4 px es el primer paso de la escala; el doble ya separaba de mas y
          obligaba a desplazar la barra. */}
      <nav
        className={`flex flex-1 flex-col overflow-y-auto overflow-x-hidden py-2 ${
          collapsed ? "items-center gap-1 px-2" : "gap-1 px-3"
        }`}
      >
        {visibleGroups.map((group) =>
          collapsed ? (
            <Link
              key={group.label}
              to={group.to ?? group.children![0].to}
              aria-label={group.label}
              onMouseEnter={(event) => openFlyout(group, event.currentTarget)}
              onMouseLeave={scheduleClose}
              onFocus={(event) => openFlyout(group, event.currentTarget)}
              onBlur={scheduleClose}
              className={`${railBase} relative ${isGroupActive(group) ? linkActive : linkInactive}`}
            >
              <group.icon className="h-[18px] w-[18px]" />
              {/* Contraida no hay sitio para cifras: un punto avisa que hay algo sin leer. */}
              {group.label === "Correo" && pendingMail > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-red" />
              )}
            </Link>
          ) : group.children ? (
            (() => {
              const open = isGroupOpen(group);
              const panelId = `nav-${group.label.toLowerCase().replace(/\s+/g, "-")}`;
              const active = isGroupActive(group);

              return (
                <div key={group.label}>
                  {/* Boton, no encabezado: el grupo se abre y se cierra, y quien
                      navega con teclado necesita alcanzarlo y saber su estado. */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className={`${linkBase} w-full border-l-2 ${
                      active && !open
                        ? "border-brand-red bg-brand-red/[0.04] font-semibold text-ink"
                        : "border-transparent text-brand-gray hover:bg-fill hover:text-ink"
                    }`}
                  >
                    <group.icon className="h-[17px] w-[17px] shrink-0" />
                    <span className="truncate">{group.label}</span>
                    {group.label === "Correo" && pendingMail > 0 && !open && (
                      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" />
                    )}
                    <ChevronDown
                      aria-hidden
                      className={`ml-auto h-3.5 w-3.5 shrink-0 text-faint transition-transform
                        duration-150 ${open ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Filete a la izquierda de los hijos: es lo que dice "esto
                      cuelga de aquello" sin recuadrar ni tintar nada. */}
                  {/* El sublistado respira arriba y abajo para no quedar pegado
                      al modulo de al lado; el filete arranca bajo el icono. */}
                  {open && (
                    <div
                      id={panelId}
                      className="mb-1 ml-[19px] mt-1 flex flex-col gap-0.5 border-l border-line pl-2.5"
                    >
                      {group.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          end={child.end}
                          // `subtle` y no `muted`: tras la fusion, `muted` paso
                          // a ser una superficie clara —lo dice el propio
                          // index.css— y como color de texto dejaba los hijos
                          // casi blancos sobre blanco. El gris de texto que
                          // cumple 5.9:1 es `subtle`.
                          className={({ isActive }) =>
                            `flex h-8 items-center gap-2.5 rounded-edge px-2.5 text-[12.5px]
                             transition-colors ${
                               isActive
                                 ? "font-semibold text-brand-red-dark"
                                 : "text-subtle hover:bg-fill hover:text-ink"
                             }`
                          }
                        >
                          <span className="truncate">{child.label}</span>
                          {child.folder && counts && <FolderBadge count={counts[child.folder]} />}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            // Mismo filete de 2 px que el grupo desplegable, transparente en
            // reposo: sin el, un modulo sin hijos queda dos pixeles corrido
            // respecto a los que si lo tienen.
            <NavLink
              key={group.to}
              to={group.to!}
              className={({ isActive }) =>
                `${linkBase} border-l-2 ${
                  isActive
                    ? "border-brand-red bg-brand-red/[0.04] font-semibold text-ink"
                    : "border-transparent text-brand-gray hover:bg-fill hover:text-ink"
                }`
              }
            >
              <group.icon className="h-[17px] w-[17px] shrink-0" />
              <span className="truncate">{group.label}</span>
            </NavLink>
          ),
        )}
      </nav>

      <div className="shrink-0 border-t border-line p-3" ref={menuRef}>
        <div className="relative">
          {menuOpen && (
            <div
              role="menu"
              className="animate-plf-toast-in absolute bottom-[52px] left-0 z-20 w-full min-w-[224px]
                rounded-edge border border-line bg-white p-1.5
                shadow-[0_4px_8px_rgba(27,27,29,0.04),0_24px_48px_-20px_rgba(27,27,29,0.22)]"
            >
              <div className="mb-1 border-b border-line-soft px-2.5 pb-2.5 pt-2">
                <p className="truncate font-heading text-[12.5px] font-semibold text-ink">{local}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-faint">{user?.email}</p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setChangingPassword(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-edge px-2.5 py-2 text-left text-[13px]
                  text-brand-gray transition-colors hover:bg-fill hover:text-ink"
              >
                <KeyRound className="h-4 w-4" />
                Cambiar contraseña
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => logout()}
                className="flex w-full items-center gap-2.5 rounded-edge px-2.5 py-2 text-left text-[13px]
                  font-medium text-brand-red-dark transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={collapsed ? local : undefined}
            className={`flex w-full items-center rounded-edge transition-colors
              ${collapsed ? "justify-center py-1.5" : "gap-2.5 py-1.5 pl-1.5 pr-2"}
              ${menuOpen ? "bg-fill" : "hover:bg-fill"}`}
          >
            <span
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-ink
                font-heading text-[12px] font-semibold text-white"
            >
              {initials}
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[12.5px] font-semibold leading-tight text-ink">
                    {local}
                  </span>
                  <span className="block truncate text-[11px] leading-tight text-faint">
                    {user?.isAdmin ? "Administrador" : "Staff"}
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-faint transition-transform ${menuOpen ? "rotate-180" : ""}`}
                />
              </>
            )}
          </button>
        </div>
      </div>

      {collapsed && flyout && (
        <div
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{ top: flyout.top, left: flyout.left }}
          className="animate-plf-toast-in fixed z-30 w-[196px] rounded-edge border border-line
            bg-white p-1.5 shadow-[0_4px_8px_rgba(27,27,29,0.04),0_24px_48px_-20px_rgba(27,27,29,0.22)]"
        >
          <p
            className="flex items-center gap-2 px-2.5 pb-1.5 pt-1 font-heading text-[10px]
              font-semibold uppercase tracking-[0.1em] text-faint"
          >
            <flyout.group.icon className="h-[13px] w-[13px]" />
            {flyout.group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {flyout.group.children?.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                end={child.end}
                onClick={() => setFlyout(null)}
                className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </aside>
  );
}
