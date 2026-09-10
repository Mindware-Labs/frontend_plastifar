import {
  Archive,
  Bell,
  ChevronDown,
  Inbox,
  KeyRound,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
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
import { Logo } from "../Logo";
import { formatDisplayName, formatInitials } from "../../lib/format";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { NotificationsModal } from "./NotificationsModal";
import { SignatureModal } from "./SignatureModal";

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
    label: "Tickets",
    icon: TicketIcon,
    children: [
      { label: "Bandeja", to: "/tickets", end: true, icon: TicketIcon },
      { label: "Motivos", to: "/tickets/motivos", icon: Tag },
    ],
  },
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
    label: "Personal",
    icon: Users,
    children: [
      { label: "Colaboradores", to: "/staff", icon: Users },
      { label: "Roles", to: "/roles", icon: ShieldCheck },
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
      className={`ml-auto shrink-0 rounded-md px-1.5 py-0.2 font-heading text-[10.5px] font-bold tabular-nums transition-colors ${
        isActive
          ? "bg-brand-red/10 text-brand-red"
          : "bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200/70 group-hover:text-zinc-900"
      }`}
    >
      {count.unread > 99 ? "99+" : count.unread}
    </span>
  );
}

const collapsedKey = "plf.sidebar-collapsed";
const ticketsExpandedKey = "plf.sidebar-tickets-expanded";
const mailExpandedKey = "plf.sidebar-mail-expanded";
const personalExpandedKey = "plf.sidebar-personal-expanded";

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
  const [ticketsExpanded, setTicketsExpanded] = useState(() => readGroupExpanded(ticketsExpandedKey));
  const [mailExpanded, setMailExpanded] = useState(() => readGroupExpanded(mailExpandedKey));
  const [personalExpanded, setPersonalExpanded] = useState(() => readGroupExpanded(personalExpandedKey));
  const [menuOpen, setMenuOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [editingSignature, setEditingSignature] = useState(false);
  const [editingAlerts, setEditingAlerts] = useState(false);
  const [flyout, setFlyout] = useState<Flyout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  function toggleGroup(label: string) {
    if (label === "Tickets") {
      setTicketsExpanded((prev) => {
        const next = !prev;
        try {
          localStorage.setItem(ticketsExpandedKey, next ? "1" : "0");
        } catch {
          // ignore
        }
        return next;
      });
    } else if (label === "Correo") {
      setMailExpanded((prev) => {
        const next = !prev;
        try {
          localStorage.setItem(mailExpandedKey, next ? "1" : "0");
        } catch {
          // ignore
        }
        return next;
      });
    } else if (label === "Personal") {
      setPersonalExpanded((prev) => {
        const next = !prev;
        try {
          localStorage.setItem(personalExpandedKey, next ? "1" : "0");
        } catch {
          // ignore
        }
        return next;
      });
    }
  }

  function isGroupExpanded(label: string) {
    if (label === "Tickets") return ticketsExpanded;
    if (label === "Correo") return mailExpanded;
    if (label === "Personal") return personalExpanded;
    return true;
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

  const displayName = formatDisplayName(user?.firstName, user?.lastName, user?.email);
  const initials = formatInitials(user?.firstName, user?.lastName, user?.email);
  const pendingMail = counts
    ? counts.inbox.unread + counts.archived.unread + counts.starred.unread + counts.trash.unread
    : 0;

  return (
    <aside
      className={`flex h-screen shrink-0 flex-col border-r border-zinc-200/80 bg-white select-none
        transition-[width] duration-200 ease-out ${collapsed ? "w-[68px]" : "w-60"}`}
    >
      {/* 1. Cabecera superior: Logotipo y control de contracción */}
      <div
        className={`flex shrink-0 items-center border-b border-zinc-200/80 transition-all duration-200 ${
          collapsed
            ? "h-[84px] flex-col items-center justify-center gap-2.5 px-2"
            : "h-14 justify-between px-3"
        }`}
      >
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2.5 pl-0.5">
              <Link
                to="/bandeja"
                className="transition-opacity hover:opacity-85 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/20 rounded-md"
                title="Plastifar · Ir a Bandeja"
              >
                <Logo variant="color" height={22} />
              </Link>
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-heading text-[9.5px] font-semibold tracking-wider text-zinc-500">
                OPS
              </span>
            </div>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Contraer la barra lateral"
              title="Contraer barra lateral"
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-all duration-150 hover:bg-zinc-100 hover:text-zinc-700 active:scale-95 outline-none"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <Link
              to="/bandeja"
              className="flex items-center justify-center rounded-md transition-opacity hover:opacity-85 active:scale-95 outline-none"
              title="Plastifar · Ir a Bandeja"
            >
              <Logo variant="isotipo" height={22} />
            </Link>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expandir la barra lateral"
              title="Expandir barra lateral"
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-all hover:bg-zinc-100 hover:text-zinc-700 active:scale-95 outline-none"
            >
              <PanelLeftOpen className="h-4 w-4" />
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
                className={`group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                  isGroupActive(group)
                    ? "bg-zinc-100 text-zinc-900 shadow-2xs font-semibold"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:scale-95"
                }`}
              >
                <group.icon className="h-4.5 w-4.5 transition-transform duration-150 group-hover:scale-105" />

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
                className="group/header flex w-full items-center justify-between px-2.5 py-1 text-left transition-colors duration-150 rounded-md hover:bg-zinc-100/60 outline-none select-none cursor-pointer"
                title={isGroupExpanded(group.label) ? `Ocultar ${group.label}` : `Mostrar ${group.label}`}
              >
                <span className="font-heading text-[11.5px] font-medium text-zinc-400 group-hover/header:text-zinc-700 transition-colors">
                  {group.label}
                </span>
                <div className="flex items-center gap-1.5">
                  {!isGroupExpanded(group.label) && group.label === "Correo" && pendingMail > 0 && (
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-red px-1.5 font-heading text-[9.5px] font-bold text-white shadow-2xs">
                      {pendingMail > 99 ? "99+" : pendingMail}
                    </span>
                  )}
                  <ChevronDown
                    className={`h-3 w-3 text-zinc-400 transition-transform duration-200 ease-out group-hover/header:text-zinc-600 ${
                      isGroupExpanded(group.label) ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                </div>
              </button>

              {/* Opciones con animación suave de colapso */}
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                  isGroupExpanded(group.label)
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0 pointer-events-none"
                }`}
              >
                <div className="overflow-hidden flex flex-col gap-0.5 pt-0.5">
                  {visibleChildren(group).map((child) => {
                    const hasUnread = Boolean(child.folder && counts && counts[child.folder]?.unread > 0);
                    return (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.end}
                        className={({ isActive }) =>
                          `group relative flex h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors duration-150 outline-none select-none ${
                            isActive
                              ? "bg-zinc-100 text-zinc-900 font-semibold shadow-2xs"
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
      {collapsed && flyout && (
        <div
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{ top: flyout.top, left: flyout.left }}
          className="animate-plf-toast-in fixed z-40 w-[200px] rounded-xl border border-zinc-200/90 bg-white p-1.5 shadow-[0_8px_24px_-4px_rgba(27,27,29,0.12),0_2px_6px_rgba(27,27,29,0.04)]"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-2.5 pb-2 pt-1">
            <span className="flex items-center gap-2 font-heading text-[11.5px] font-medium text-zinc-400">
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
                  onClick={() => setFlyout(null)}
                  className={({ isActive }) =>
                    `group flex h-[32px] items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] transition-colors ${
                      isActive
                        ? "bg-zinc-100 text-zinc-900 font-semibold shadow-2xs"
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
          {menuOpen && (
            <div
              role="menu"
              className={`animate-plf-toast-in absolute bottom-[calc(100%+8px)] z-30 min-w-[240px] rounded-xl border border-zinc-200/90 bg-white p-1.5 shadow-[0_12px_32px_-6px_rgba(27,27,29,0.14),0_2px_8px_rgba(27,27,29,0.04)] ${
                collapsed ? "left-2" : "left-0 w-full"
              }`}
            >
              {/* Encabezado del usuario */}
              <div className="mb-1 flex items-center gap-2.5 border-b border-zinc-100 p-2">
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
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
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
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <Bell className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-700 transition-colors" />
                  <span>Avisos y notificaciones</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setChangingPassword(true);
                  }}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <KeyRound className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-700 transition-colors" />
                  <span>Cambiar contraseña</span>
                </button>

                <div className="my-1 border-t border-zinc-100" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => logout()}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="h-3.5 w-3.5 text-red-500 group-hover:text-red-600 transition-colors" />
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
            className={`group flex w-full items-center rounded-lg transition-colors duration-150 outline-none ${
              menuOpen
                ? "bg-zinc-100 text-zinc-900"
                : "hover:bg-zinc-100/80 text-zinc-700"
            } ${collapsed ? "justify-center p-2" : "gap-2.5 p-2"}`}
          >
            {/* Avatar circular con aro y presencia en línea */}
            <div className="relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-zinc-900 font-heading text-[11px] font-bold text-white shadow-xs transition-transform group-hover:scale-105">
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
                  className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-200 ${
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
