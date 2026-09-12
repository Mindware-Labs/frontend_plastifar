import {
  Archive,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ClipboardCheck,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  PanelLeft,
  PenLine,
  Send,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  Users,
  Ticket as TicketIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useEmailCounts } from "../../context/useEmailCounts";
import { useIsMobile } from "../../hooks/useIsMobile";
import { usePermissions } from "../../hooks/usePermissions";
import type { PermissionKey } from "../../lib/permissions";
import type { EmailFolderCounts, FolderCount } from "../../types/api";
import { Logo } from "../Logo";
import { formatDisplayName, formatInitials } from "../../lib/format";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { NotificationsModal } from "./NotificationsModal";
import { SignatureModal } from "./SignatureModal";

/** Solo las claves de EmailFolderCounts que son una carpeta con contador. */
type MailFolderKey = {
  [K in keyof EmailFolderCounts]: EmailFolderCounts[K] extends FolderCount ? K : never;
}[keyof EmailFolderCounts];

interface NavItem {
  label: string;
  to: string;
  /**
   * Opcional a proposito. Correo y Personal identifican cada carpeta con su
   * icono; Configuracion son siete renglones de catalogo donde siete iconos
   * mas serian ruido, no señal.
   */
  icon?: LucideIcon;
  /** Coincidencia exacta: evita que "/bandeja" quede activa también en sus subcarpetas. */
  end?: boolean;
  /**
   * Carpeta de correo cuyo contador se pinta al final del renglon. Es la lista
   * explicita y no `keyof EmailFolderCounts` porque ese tipo incluye
   * `assignedUnseen`, que es un numero suelto y no una carpeta navegable.
   */
  folder?: MailFolderKey;
  /** Permiso que exige la ruta. Ausente = abierta a todo el personal. */
  permission?: PermissionKey;
  /** Solo lo ve un administrador. */
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  /**
   * Encabezado bajo el que se agrupa el modulo. Siete modulos seguidos se leen
   * como una lista de la compra; en tres bloques con nombre, el ojo salta al
   * bloque y despues busca dentro.
   */
  section: "Principal" | "Gestión" | "Otros";
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
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard", section: "Principal" },
  {
    label: "Tickets",
    icon: TicketIcon,
    section: "Principal",
    permission: "tickets.read",
    children: [{ label: "Bandeja", to: "/tickets", end: true, icon: TicketIcon }],
  },
  {
    label: "Correo",
    icon: Inbox,
    section: "Principal",
    permission: "tickets.read",
    children: [
      { label: "Bandeja", to: "/bandeja", end: true, folder: "inbox", icon: Inbox },
      { label: "Destacados", to: "/bandeja/destacados", folder: "starred", icon: Star },
      { label: "Enviados", to: "/bandeja/enviados", folder: "sent", icon: Send },
      { label: "Archivados", to: "/bandeja/archivados", folder: "archived", icon: Archive },
      { label: "Papelera", to: "/bandeja/papelera", folder: "trash", icon: Trash2 },
      { label: "Respuestas", to: "/bandeja/respuestas", icon: MessageSquareText },
    ],
  },
  {
    label: "Personal",
    icon: Users,
    section: "Gestión",
    children: [
      { label: "Colaboradores", to: "/staff", icon: Users, permission: "staff.read" },
      { label: "Roles", to: "/roles", icon: ShieldCheck, permission: "roles.read" },
      { label: "Permisos", to: "/permisos", icon: KeyRound, permission: "roles.read" },
    ],
  },
  { label: "Clientes", icon: Building2, to: "/clientes", permission: "clients.read", section: "Gestión" },
  {
    label: "Calidad",
    icon: ClipboardCheck,
    section: "Gestión",
    permission: "quality.read",
    children: [
      { label: "HCA", to: "/calidad/hca" },
      { label: "Solicitudes de crédito", to: "/calidad/creditos" },
    ],
  },
  {
    // Eran siete entradas, y cuatro —Operacion, SLA, Productividad y Volumen—
    // no tenian un solo dato: cuatro de cada siete clics daban contra una pared.
    // Ahora es una pantalla que se genera eligiendo reporte y criterios, y lo
    // bloqueado se ve en el selector, desactivado, en vez de ocupar menu.
    label: "Reportes",
    icon: BarChart3,
    section: "Otros",
    permission: "reports.read",
    to: "/reportes",
  },
  {
    label: "Configuración",
    icon: Settings,
    section: "Otros",
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

/**
 * Contador numérico estilo Gmail:
 * - Con correos sin leer: tipografía destacada con acento de marca.
 * - Solo leídos: número fino y neutro.
 */
function FolderBadge({
  count,
  isActive,
}: {
  count: { total: number; unread: number };
  isActive?: boolean;
}) {
  if (count.unread <= 0) return null;

  return (
    <span
      className={`ml-auto shrink-0 font-heading text-[12px] font-bold tabular-nums transition-colors ${
        isActive ? "text-brand-red-dark" : "text-ink"
      }`}
    >
      {count.unread > 99 ? "99+" : count.unread}
    </span>
  );
}

const linkBase =
  "flex items-center gap-2.5 rounded-edge px-3 py-2 text-[13px] font-medium transition-colors";
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

  // Lo marcado como solo administradores no aparece para el resto.
  function visibleChildren(group: NavGroup) {
    return (group.children ?? []).filter((child) => !child.adminOnly || user?.isAdmin);
  }
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
  const [preferCollapsed, setPreferCollapsed] = useState(readCollapsed);

  /**
   * Bajo `lg` la barra se pliega al riel, se prefiera o no.
   *
   * Expandida ocupa 240 px, y en un telefono de 390 px eso es el 62 % de la
   * pantalla: el contenido quedaba en una columna de 150 px donde una tabla no
   * cabe y un parrafo se parte en veinte lineas. No es un defecto de una
   * pantalla, es de todas. El riel de 68 px ya existia con sus paneles
   * emergentes; lo unico que faltaba era que se activara solo.
   */
  const isNarrow = useIsMobile(1023);
  const collapsed = preferCollapsed || isNarrow;

  /** El boton solo cambia la preferencia; bajo `lg` no hay nada que expandir. */
  const setCollapsed = setPreferCollapsed;
  const [menuOpen, setMenuOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [editingSignature, setEditingSignature] = useState(false);
  const [editingAlerts, setEditingAlerts] = useState(false);
  const [flyout, setFlyout] = useState<Flyout | null>(null);
  /** Solo los grupos que la persona abrio o cerro a mano; el resto sale de la ruta. */
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  /**
   * El buscador FILTRA el menu de verdad; no es un adorno.
   *
   * Un campo que no hace nada es peor que no tenerlo: promete una capacidad y
   * la incumple en el primer intento. Con siete modulos y veinte sub-secciones,
   * escribir "terri" y quedarse con Territorios ahorra abrir Configuracion y
   * recorrerla.
   */


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

  /**
   * Cuerpo de un modulo del menu. Es una funcion y no JSX en linea porque el
   * listado ahora intercala encabezados de seccion: sin extraerlo, cada rama
   * del `map` habria que duplicarla dentro del bloque del encabezado.
   */
  function renderGroup(group: NavGroup) {
    return collapsed ? (
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
                      {visibleChildren(group).map((child) => (
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
                            `group/child flex h-8 items-center gap-2.5 rounded-edge px-2.5
                             text-[12.5px] transition-colors ${
                               isActive
                                 ? "font-semibold text-brand-red-dark"
                                 : "text-subtle hover:bg-fill hover:text-ink"
                             }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {child.icon && (
                                <child.icon
                                  aria-hidden
                                  className={`h-3.5 w-3.5 shrink-0 ${
                                    isActive ? "text-brand-red" : "text-faint"
                                  }`}
                                />
                              )}
                              <span className="truncate">{child.label}</span>
                              {child.folder && counts && (
                                <FolderBadge count={counts[child.folder]} isActive={isActive} />
                              )}
                            </>
                          )}
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
    );
  }

  const displayName = formatDisplayName(user?.firstName, user?.lastName, user?.email);
  const initials = formatInitials(user?.firstName, user?.lastName, user?.email);
  const pendingMail = counts
    ? counts.inbox.unread + counts.archived.unread + counts.starred.unread + counts.trash.unread
    : 0;

  return (
    <aside
      className={`flex h-screen shrink-0 flex-col border-r border-line/80 bg-white select-none
        transition-[width] duration-200 ease-out ${collapsed ? "w-[68px]" : "w-60"}`}
    >
      {/* 1. Cabecera superior: Logotipo y control de contracción */}
      <div
        className={`flex h-16 shrink-0 items-center border-b border-line-soft transition-all duration-200 ${
          collapsed ? "flex-col justify-center gap-1.5 px-2 py-2" : "justify-between px-4"
        }`}
      >
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2.5">
              <Link
                to="/bandeja"
                className="transition-opacity hover:opacity-85 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/20 rounded-edge"
                title="Plastifar · Ir a Bandeja"
              >
                <Logo variant="color" height={23} />
              </Link>
              <span className="rounded border border-line-soft bg-canvas px-1.5 py-0.5 font-heading text-[9px] font-bold tracking-[0.08em] text-subtle">
                OPS
              </span>
            </div>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Contraer la barra lateral"
              title="Contraer barra lateral"
              className="flex h-7 w-7 items-center justify-center rounded-edge text-subtle transition-all duration-150 hover:bg-canvas hover:text-ink active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-red/20 outline-none"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Link
              to="/bandeja"
              className="group flex h-9 w-9 items-center justify-center rounded-edge border border-line-soft bg-canvas transition-all hover:border-brand-red/30 hover:shadow-xs active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/20"
              title="Plastifar · Ir a Bandeja"
            >
              <Logo variant="isotipo" height={22} />
            </Link>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expandir la barra lateral"
              title="Expandir barra lateral"
              className="flex h-5 w-5 items-center justify-center rounded-edge text-faint transition-all hover:bg-canvas hover:text-ink active:scale-95"
            >
              <PanelLeft className="h-3.5 w-3.5 rotate-180" />
            </button>
          </div>
        )}
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
        {visibleGroups.map((group, index) => (
          <div key={`sec-${group.label}`} className="contents">
            {/* El encabezado se pinta cuando cambia la seccion, no una vez por
                bloque: asi el filtro puede vaciar un bloque entero y su titulo
                se va con el, en vez de quedar colgado sobre nada. */}
            {!collapsed && group.section !== visibleGroups[index - 1]?.section && (
              <p
                className={`px-3 pb-1 font-heading text-[10px] font-semibold uppercase
                  tracking-[0.08em] text-faint ${index === 0 ? "pt-1" : "pt-4"}`}
              >
                {group.section}
              </p>
            )}
            {renderGroup(group)}
          </div>
        ))}
      </nav>

      {/* Panel emergente del riel contraido: es lo unico que deja llegar a los
          hijos de un grupo cuando la barra esta plegada. */}
      {collapsed && flyout && (
        <div
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{ top: flyout.top, left: flyout.left }}
          className="animate-plf-toast-in fixed z-40 w-[210px] rounded-edge border border-line bg-white p-1.5 shadow-[0_8px_24px_-4px_rgba(27,27,29,0.14),0_2px_6px_rgba(27,27,29,0.04)]"
        >
          <div className="flex items-center justify-between border-b border-line-soft px-2.5 pb-2 pt-1.5">
            <span className="flex items-center gap-2 font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-subtle">
              <flyout.group.icon className="h-3.5 w-3.5 text-brand-gray" />
              {flyout.group.label}
            </span>
            {flyout.group.label === "Correo" && pendingMail > 0 && (
              <span className="rounded-full bg-brand-red/10 px-1.5 py-0.2 font-heading text-[10px] font-bold text-brand-red">
                {pendingMail}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-col gap-0.5">
            {visibleChildren(flyout.group).map((child) => {
              const hasUnread = Boolean(child.folder && counts && counts[child.folder]?.unread > 0);
              return (
                <NavLink
                  key={child.to}
                  to={child.to}
                  end={child.end}
                  onClick={() => setFlyout(null)}
                  className={({ isActive }) =>
                    `group flex h-[32px] items-center gap-3 rounded-md px-2.5 text-[12.5px] transition-colors ${
                      isActive
                        ? "bg-brand-red/[0.08] text-brand-red-dark font-bold"
                        : hasUnread
                        ? "font-bold text-ink hover:bg-fill"
                        : "font-medium text-brand-gray hover:bg-fill hover:text-ink"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {child.icon && (
                      <child.icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? "text-brand-red"
                            : hasUnread
                            ? "text-brand-gray"
                            : "text-faint group-hover:text-brand-gray"
                        }`}
                      />
                      )}
                      <span className="truncate flex-1">{child.label}</span>
                      {child.folder && counts && (
                        <FolderBadge count={counts[child.folder]} isActive={isActive} />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Pie de Tarjeta de Usuario y Menú Desplegable */}
      <div className="shrink-0 border-t border-line p-2.5" ref={menuRef}>
        <div className="relative">
          {/* Menú flotante de perfil */}
          {menuOpen && (
            <div
              role="menu"
              className="animate-plf-toast-in absolute bottom-[calc(100%+8px)] left-0 z-30 w-full min-w-[240px] rounded-edge border border-line bg-white p-1.5 shadow-[0_12px_32px_-6px_rgba(27,27,29,0.16),0_2px_8px_rgba(27,27,29,0.06)]"
            >
              {/* Encabezado del usuario */}
              <div className="mb-1.5 flex items-center gap-2.5 border-b border-line-soft p-2">
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-heading text-[12px] font-bold text-white shadow-xs">
                  {initials}
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-brand-green"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-[13px] font-bold text-ink leading-tight">
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] text-faint leading-tight mt-0.5">{user?.email}</p>
                  <span className="mt-1 inline-flex items-center rounded-full bg-brand-red/[0.08] px-2 py-0.2 font-heading text-[9.5px] font-bold text-brand-red tracking-wide">
                    {user?.isAdmin ? "ADMINISTRADOR" : "COLABORADOR"}
                  </span>
                </div>
              </div>

              {/* Botones de opciones */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditingSignature(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-edge px-2.5 py-1.5 text-left text-[12.5px] text-[#3e3e44] transition-colors hover:bg-canvas hover:text-ink"
                >
                  <PenLine className="h-3.5 w-3.5 text-subtle" />
                  <span>Tu firma de correo</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditingAlerts(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-edge px-2.5 py-1.5 text-left text-[12.5px] text-[#3e3e44] transition-colors hover:bg-canvas hover:text-ink"
                >
                  <Bell className="h-3.5 w-3.5 text-subtle" />
                  <span>Avisos y notificaciones</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setChangingPassword(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-edge px-2.5 py-1.5 text-left text-[12.5px] text-[#3e3e44] transition-colors hover:bg-canvas hover:text-ink"
                >
                  <KeyRound className="h-3.5 w-3.5 text-subtle" />
                  <span>Cambiar contraseña</span>
                </button>

                <div className="my-1 border-t border-line-soft" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => logout()}
                  className="flex w-full items-center gap-2.5 rounded-edge px-2.5 py-1.5 text-left text-[12.5px] font-medium text-brand-red-dark transition-colors hover:bg-red-50/80"
                >
                  <LogOut className="h-3.5 w-3.5 text-brand-red" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          )}

          {/* Gatillo del perfil */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={collapsed ? `${displayName} · ${user?.email}` : undefined}
            className={`group flex w-full items-center rounded-edge border transition-all duration-150 outline-none ${
              menuOpen
                ? "border-line-strong bg-fill shadow-xs ring-1 ring-line-strong"
                : "border-transparent hover:border-line-soft hover:bg-canvas"
            } ${collapsed ? "justify-center p-1.5" : "gap-2.5 p-1.5"}`}
          >
            {/* Avatar circular con aro y presencia en línea */}
            <div className="relative flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-ink font-heading text-[11.5px] font-bold text-white shadow-xs transition-transform group-hover:scale-105">
              {initials}
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-green"
              />
            </div>

            {!collapsed && (
              <>
                <div className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-heading text-[12.5px] font-bold leading-tight text-ink">
                    {displayName}
                  </span>
                  <span className="block truncate text-[10.5px] leading-tight text-faint mt-0.5">
                    {user?.isAdmin ? "Administrador" : "Staff"}
                  </span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-faint transition-transform duration-200 ${
                    menuOpen ? "rotate-180 text-ink" : "group-hover:text-subtle"
                  }`}
                />
              </>
            )}
          </button>
        </div>
      </div>

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
      {editingSignature && <SignatureModal onClose={() => setEditingSignature(false)} />}
      {editingAlerts && <NotificationsModal onClose={() => setEditingAlerts(false)} />}
    </aside>
  );
}
