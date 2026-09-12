import {
  Archive,
  Bell,
  ChevronDown,
  Gavel,
  Inbox,
  KeyRound,
  LogOut,
  PenLine,
  MessageSquareText,
  Send,
  ShieldCheck,
  Star,
  Tag,
  Trash2,
  Users,
  Ticket as TicketIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useEmailCounts } from "../../context/useEmailCounts";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import { Logo } from "../Logo";
import { formatDisplayName, formatInitials } from "../../lib/format";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { NotificationsModal } from "./NotificationsModal";
import { SignatureModal } from "./SignatureModal";
import { useHasOpenedNotifications } from "../../hooks/useNotifyPrefs";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Coincidencia exacta: evita que "/bandeja" quede activa también en sus subcarpetas. */
  end?: boolean;
  /** Carpeta de correo cuyo contador se refleja al final del renglón. */
  folder?: "inbox" | "archived" | "starred" | "trash" | "sent";
  /** Solo lo ve un administrador. */
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  to?: string;
  children?: NavItem[];
}

/** Árbol de navegación: cada elemento cuenta con su propio icono vectorizado y ruta. */
const groups: NavGroup[] = [
  {
    label: "Correo",
    icon: Inbox,
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
    label: "Tickets",
    icon: TicketIcon,
    children: [
      { label: "Bandeja", to: "/tickets", end: true, icon: TicketIcon },
      { label: "Motivos", to: "/tickets/motivos", icon: Tag },
      { label: "Veredictos", to: "/tickets/veredictos", icon: Gavel },
    ],
  },
  {
    label: "Personal",
    icon: Users,
    children: [
      { label: "Colaboradores", to: "/staff", icon: Users },
      { label: "Roles", to: "/roles", icon: ShieldCheck },
    ],
  },
];

/** Marca roja al borde de la barra junto a lo activo: crece con el resorte y se apaga al cambiar de ruta. */
function ActiveMark({ active, className = "" }: { active: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-red transition-transform duration-280 ease-plf-spring motion-reduce:transition-none ${
        active ? "scale-y-100" : "scale-y-0"
      } ${className}`}
    />
  );
}

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
      className={`ml-auto shrink-0 rounded-md px-1.5 py-0.5 font-heading text-[10px] font-bold leading-none tabular-nums transition-colors duration-200 ${
        isActive
          ? "bg-brand-red/10 text-brand-red"
          : "bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200/70 group-hover:text-zinc-900"
      }`}
    >
      {count.unread > 99 ? "99+" : count.unread}
    </span>
  );
}

/**
 * Icono de colapso/expansión de barra lateral artesanal y micro-interactivo:
 * - Marco con esquinas redondeadas continuas y grosor afinado de 1.25px.
 * - Carril izquierdo que simula la barra lateral con relieve sutil y realce rojo de marca al hacer hover.
 * - Línea divisoria y chevron interior dinámico que se desliza sutilmente en la dirección de la acción.
 */
function SidebarToggleIcon({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Marco perimetral */}
      <rect
        x="1.75"
        y="2.25"
        width="14.5"
        height="13.5"
        rx="2.75"
        className="stroke-current"
        strokeWidth="1.25"
      />
      {/* Carril del panel lateral con realce interactivo */}
      <rect
        x="2.5"
        y="3"
        width="3.75"
        height="12"
        rx="1.75"
        className={`transition-colors duration-200 ${
          collapsed
            ? "fill-zinc-200/80"
            : "fill-zinc-200/60 group-hover:fill-brand-red/20"
        }`}
      />
      {/* Línea divisoria del carril */}
      <line
        x1="6.75"
        y1="2.25"
        x2="6.75"
        y2="15.75"
        className="stroke-current"
        strokeWidth="1.2"
      />
      {/* Chevron de acción dinámico con animación táctil al hover */}
      {collapsed ? (
        <path
          d="M9.75 6.5L12.25 9L9.75 11.5"
          className="stroke-current transition-transform duration-200 ease-out group-hover:translate-x-0.5"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M12.25 6.5L9.75 9L12.25 11.5"
          className="stroke-current transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

const collapsedKey = "plf.sidebar-collapsed";

/** Claves heredadas: se conservan para no perder lo que cada persona ya tenía plegado. */
const groupKeys: Record<string, string> = {
  Correo: "plf.sidebar-mail-expanded",
  Tickets: "plf.sidebar-tickets-expanded",
  Personal: "plf.sidebar-personal-expanded",
};

/** En navegacion privada leer localStorage lanza: la barra abre expandida. */
function readCollapsed() {
  try {
    return localStorage.getItem(collapsedKey) === "1";
  } catch {
    return false;
  }
}

function readGroupExpanded(key: string, defaultValue = true) {
  try {
    const saved = localStorage.getItem(key);
    return saved !== null ? saved === "1" : defaultValue;
  } catch {
    return defaultValue;
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
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((group) => [group.label, readGroupExpanded(groupKeys[group.label])])),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [editingSignature, setEditingSignature] = useState(false);
  const [editingAlerts, setEditingAlerts] = useState(false);
  const hasOpenedAlerts = useHasOpenedNotifications();
  // El contenido del desplegable sobrevive al cierre para que la salida tenga qué animar.
  const [flyout, setFlyout] = useState<Flyout | null>(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const menuMotion = useDisclosureMotion<HTMLDivElement>(menuOpen, { direction: "up" });
  const flyoutMotion = useDisclosureMotion<HTMLDivElement>(collapsed && flyoutOpen);

  function toggleGroup(label: string) {
    setExpanded((prev) => {
      const next = !(prev[label] ?? true);
      try {
        localStorage.setItem(groupKeys[label], next ? "1" : "0");
      } catch {
        // Sin almacenamiento el pliegue funciona igual, solo no se recuerda.
      }
      return { ...prev, [label]: next };
    });
  }

  function isGroupExpanded(label: string) {
    return expanded[label] ?? true;
  }

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
      if (event.key === "Escape") setFlyoutOpen(false);
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
    setFlyoutOpen(true);
  }

  /** Retardo corto: da tiempo a cruzar el hueco entre el icono y el panel. */
  function scheduleClose() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setFlyoutOpen(false), 140);
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    setMenuOpen(false);
    setFlyoutOpen(false);
    flyoutMotion.snap();
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

  const displayName = formatDisplayName(user?.firstName, user?.lastName, user?.email);
  const initials = formatInitials(user?.firstName, user?.lastName, user?.email);
  const pendingMail = counts
    ? counts.inbox.unread + counts.archived.unread + counts.starred.unread + counts.trash.unread
    : 0;

  return (
    <aside
      className={`flex h-screen shrink-0 flex-col border-r border-zinc-200/80 bg-white select-none
        transition-[width] duration-280 ease-plf-spring motion-reduce:transition-none ${collapsed ? "w-[68px]" : "w-60"}`}
    >
      {/* 1. Cabecera superior: Logotipo y control de contracción */}
      <div
        className={`flex shrink-0 items-center border-b border-zinc-200/80 transition-all duration-200 ${
          collapsed
            ? "h-20 flex-col items-center justify-center gap-2 px-2"
            : "h-14 justify-between px-3.5"
        }`}
      >
        {!collapsed ? (
          <>
            <Link
              to="/bandeja"
              className="group flex items-center pl-1 transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/20 rounded-lg py-1"
              title="Plastifar · Ir a Bandeja"
            >
              <Logo
                variant="color"
                height={24}
                className="transition-transform duration-150 group-hover:scale-[1.01]"
              />
            </Link>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Contraer la barra lateral"
              title="Contraer barra lateral"
              className="group flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-800 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25 cursor-pointer motion-reduce:active:scale-100"
            >
              <SidebarToggleIcon collapsed={false} />
            </button>
          </>
        ) : (
          <>
            <Link
              to="/bandeja"
              className="flex items-center justify-center rounded-lg transition-opacity hover:opacity-90 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/20"
              title="Plastifar · Ir a Bandeja"
            >
              <Logo variant="isotipo" height={24} />
            </Link>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expandir la barra lateral"
              title="Expandir barra lateral"
              className="group flex h-7.5 w-7.5 items-center justify-center rounded-lg text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-800 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25 cursor-pointer motion-reduce:active:scale-100"
            >
              <SidebarToggleIcon collapsed={true} />
            </button>
          </>
        )}
      </div>

      {/* 2. Árbol de Navegación Principal */}
      <nav
        className={`flex-1 overflow-y-auto overflow-x-hidden py-3 ${
          collapsed ? "flex flex-col items-center gap-2 px-2" : "px-2 space-y-3"
        }`}
      >
        {groups.map((group) =>
          collapsed ? (
            /* Modo Riel (Contraído) */
            <div key={group.label} className="relative">
              <Link
                to={group.to ?? group.children![0].to}
                aria-label={group.label}
                onMouseEnter={(event) => openFlyout(group, event.currentTarget)}
                onMouseLeave={scheduleClose}
                onFocus={(event) => openFlyout(group, event.currentTarget)}
                onBlur={scheduleClose}
                className={`group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
                  isGroupActive(group)
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:scale-95 motion-reduce:active:scale-100"
                }`}
              >
                <ActiveMark active={isGroupActive(group)} className="-left-4" />
                <group.icon className="h-4.5 w-4.5" strokeWidth={isGroupActive(group) ? 2.25 : 2} />

                {/* Badge con aviso de pendientes en modo contraído */}
                {group.label === "Correo" && pendingMail > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-red px-1 font-heading text-[9.5px] font-bold text-white shadow-[0_2px_6px_rgba(228,0,43,0.5)]">
                    {pendingMail > 99 ? "99+" : pendingMail}
                  </span>
                )}
              </Link>
            </div>
          ) : (
            /* Modo Extendido (Expandido) */
            <div key={group.label} className="flex flex-col">
              {/* Cabecera interactiva colapsable estilo moderno y discreto */}
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                aria-expanded={isGroupExpanded(group.label)}
                className="group/header flex h-7 w-full items-center justify-between rounded-md px-2.5 text-left transition-colors duration-150 hover:bg-zinc-100/60 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/25"
                title={isGroupExpanded(group.label) ? `Ocultar ${group.label}` : `Mostrar ${group.label}`}
              >
                <span className="font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400 transition-colors group-hover/header:text-zinc-700">
                  {group.label}
                </span>
                <div className="flex items-center gap-1.5">
                  {!isGroupExpanded(group.label) && group.label === "Correo" && pendingMail > 0 && (
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-red px-1.5 font-heading text-[9.5px] font-bold text-white shadow-2xs">
                      {pendingMail > 99 ? "99+" : pendingMail}
                    </span>
                  )}
                  <ChevronDown
                    className={`h-3 w-3 text-zinc-400 transition-transform duration-280 ease-plf-spring group-hover/header:text-zinc-600 motion-reduce:transition-none ${
                      isGroupExpanded(group.label) ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                </div>
              </button>

              {/* Opciones con animación suave de colapso */}
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-280 ease-plf-spring motion-reduce:transition-none ${
                  isGroupExpanded(group.label)
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0 pointer-events-none"
                }`}
              >
                {/* Margen negativo compensado: el recorte del pliegue no debe tapar la marca activa del borde. */}
                <div className="-mx-2 flex flex-col gap-0.5 overflow-hidden px-2 pt-0.5">
                  {visibleChildren(group).map((child) => {
                    const hasUnread = Boolean(child.folder && counts && counts[child.folder]?.unread > 0);
                    return (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.end}
                        className={({ isActive }) =>
                          `group relative flex h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
                            isActive
                              ? "bg-zinc-100 text-zinc-900 font-semibold"
                              : hasUnread
                              ? "text-zinc-900 font-semibold hover:bg-zinc-100/70"
                              : "text-zinc-600 font-medium hover:bg-zinc-100/70 hover:text-zinc-900"
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <ActiveMark active={isActive} className="-left-2" />
                            <child.icon
                              strokeWidth={isActive ? 2.25 : 2}
                              className={`h-4 w-4 shrink-0 transition-colors ${
                                isActive
                                  ? "text-zinc-900"
                                  : hasUnread
                                  ? "text-zinc-800"
                                  : "text-zinc-400 group-hover:text-zinc-700"
                              }`}
                            />

                            <span className="min-w-0 flex-1 truncate">
                              {child.label}
                            </span>

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
            </div>
          ),
        )}
      </nav>

      {/* 3. Flyout en Modo Contraído */}
      {collapsed && flyoutMotion.mounted && flyout && (
        <div
          ref={flyoutMotion.ref}
          aria-hidden={flyoutMotion.exiting}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{ top: flyout.top, left: flyout.left, transformOrigin: "0 24px" }}
          className={`fixed z-40 w-[200px] rounded-xl border border-zinc-200/90 bg-white p-1.5 shadow-[0_8px_24px_-4px_rgba(27,27,29,0.12),0_2px_6px_rgba(27,27,29,0.04)] ${
            flyoutMotion.exiting ? "pointer-events-none" : ""
          }`}
        >
          <div
            data-motion-item
            className="flex items-center justify-between border-b border-zinc-100 px-2.5 pb-2 pt-1"
          >
            <span className="flex items-center gap-2 font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
              <flyout.group.icon className="h-3.5 w-3.5 text-zinc-400" />
              {flyout.group.label}
            </span>
            {flyout.group.label === "Correo" && pendingMail > 0 && (
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.2 font-heading text-[10px] font-bold text-zinc-700">
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
                  data-motion-item
                  onClick={() => setFlyoutOpen(false)}
                  className={({ isActive }) =>
                    `group flex h-[32px] items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] transition-colors focus-visible:ring-2 focus-visible:ring-brand-red/25 outline-none ${
                      isActive
                        ? "bg-zinc-100 text-zinc-900 font-semibold"
                        : hasUnread
                        ? "text-zinc-900 font-semibold hover:bg-zinc-100/70"
                        : "text-zinc-600 font-medium hover:bg-zinc-100/70 hover:text-zinc-900"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <child.icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? "text-zinc-900"
                            : hasUnread
                            ? "text-zinc-800"
                            : "text-zinc-400 group-hover:text-zinc-700"
                        }`}
                      />
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

      {/* 4. Pie de Tarjeta de Usuario y Menú Desplegable */}
      <div className="shrink-0 border-t border-zinc-200/80 p-2" ref={menuRef}>
        <div className="relative">
          {/* Menú flotante de perfil */}
          {menuMotion.mounted && (
            <div
              ref={menuMotion.ref}
              role="menu"
              aria-hidden={menuMotion.exiting}
              style={{ transformOrigin: collapsed ? "0 24px" : "24px bottom" }}
              className={`absolute z-30 rounded-xl border border-zinc-200/90 bg-white p-1.5 shadow-[0_12px_32px_-6px_rgba(27,27,29,0.14),0_2px_8px_rgba(27,27,29,0.04)] ${
                collapsed
                  ? "left-[calc(100%+8px)] bottom-0 w-56"
                  : "left-0 right-0 bottom-[calc(100%+8px)] w-full"
              } ${menuMotion.exiting ? "pointer-events-none" : ""}`}
            >
              {/* Encabezado del usuario */}
              <div data-motion-item className="mb-1 flex items-center gap-2.5 border-b border-zinc-100 p-2">
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 font-heading text-[11.5px] font-bold text-white shadow-xs">
                  {initials}
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-[12.5px] font-semibold text-zinc-900 leading-tight">
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] text-zinc-400 leading-tight mt-0.5">{user?.email}</p>
                  <span className="mt-1 inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 font-heading text-[9.5px] font-semibold text-zinc-600 tracking-wide">
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
                  data-motion-item
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-zinc-700 transition-colors outline-none hover:bg-zinc-100 hover:text-zinc-900 focus-visible:bg-zinc-100 focus-visible:text-zinc-900"
                >
                  <PenLine className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-700 transition-colors" />
                  <span>Tu firma de correo</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditingAlerts(true);
                  }}
                  data-motion-item
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-zinc-700 transition-colors outline-none hover:bg-zinc-100 hover:text-zinc-900 focus-visible:bg-zinc-100 focus-visible:text-zinc-900"
                >
                  <Bell className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-700 transition-colors" />
                  <span>Avisos</span>
                  {!hasOpenedAlerts && (
                    <span className="ml-auto rounded-full bg-brand-red/10 px-1.5 py-0.5 font-heading text-[9.5px] font-bold text-brand-red">
                      Nuevo
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setChangingPassword(true);
                  }}
                  data-motion-item
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-zinc-700 transition-colors outline-none hover:bg-zinc-100 hover:text-zinc-900 focus-visible:bg-zinc-100 focus-visible:text-zinc-900"
                >
                  <KeyRound className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-700 transition-colors" />
                  <span>Cambiar contraseña</span>
                </button>

                <div className="my-1 border-t border-zinc-100" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => logout()}
                  data-motion-item
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-brand-red-dark transition-colors outline-none hover:bg-brand-red/[0.06] focus-visible:bg-brand-red/[0.06]"
                >
                  <LogOut className="h-3.5 w-3.5 text-brand-red transition-colors" />
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
            className={`group flex w-full items-center rounded-lg transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25 cursor-pointer ${
              menuOpen
                ? "bg-zinc-100 text-zinc-900"
                : "hover:bg-zinc-100/80 text-zinc-700"
            } ${collapsed ? "justify-center p-2" : "gap-2.5 p-2"}`}
          >
            {/* Avatar circular con aro y presencia en línea */}
            <div className="relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-zinc-900 font-heading text-[11px] font-bold text-white shadow-xs">
              {initials}
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500"
              />
            </div>

            {!collapsed && (
              <>
                <div className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-heading text-[12.5px] font-semibold leading-tight text-zinc-800">
                    {displayName}
                  </span>
                  <span className="block truncate text-[11px] leading-tight text-zinc-400 mt-0.5 font-normal">
                    {user?.isAdmin ? "Administrador" : "Staff"}
                  </span>
                </div>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-280 ease-plf-spring motion-reduce:transition-none ${
                    menuOpen ? "rotate-180 text-zinc-800" : "group-hover:text-zinc-600"
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
