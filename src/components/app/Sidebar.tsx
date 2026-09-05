import {
  Archive,
  Ban,
  Bell,
  ChevronDown,
  Inbox,
  KeyRound,
  LogOut,
  PanelLeft,
  PenLine,
  MessageSquareText,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useEmailCounts } from "../../context/useEmailCounts";
import type { EmailFolderCounts } from "../../types/api";
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
  folder?: keyof EmailFolderCounts;
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
      { label: "Enviados", to: "/bandeja/enviados", folder: "sent", icon: Send },
      { label: "Archivados", to: "/bandeja/archivados", folder: "archived", icon: Archive },
      { label: "No deseado", to: "/bandeja/junk", folder: "junk", icon: ShieldAlert },
      { label: "Papelera", to: "/bandeja/papelera", folder: "trash", icon: Trash2 },
      { label: "Supresión", to: "/bandeja/supresion", icon: Ban },
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
 * Pastilla de conteo:
 * - Sin leer: rojo corporativo Plastifar (Pantone 185 C) con micro-relieve.
 * - Leído: total neutro discreto.
 */
function FolderBadge({
  count,
  isActive,
}: {
  count: { total: number; unread: number };
  isActive?: boolean;
}) {
  if (count.unread > 0) {
    return (
      <span
        className="ml-auto flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-red px-1.5 font-heading text-[10px] font-bold tabular-nums text-white shadow-xs transition-transform duration-150 group-hover:scale-105"
      >
        {count.unread > 99 ? "99+" : count.unread}
      </span>
    );
  }

  if (count.total === 0) return null;

  return (
    <span
      className={`ml-auto shrink-0 text-[11px] tabular-nums transition-colors ${
        isActive ? "font-semibold text-brand-gray" : "font-medium text-faint group-hover:text-subtle"
      }`}
    >
      {count.total}
    </span>
  );
}

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
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [editingSignature, setEditingSignature] = useState(false);
  const [editingAlerts, setEditingAlerts] = useState(false);
  const [flyout, setFlyout] = useState<Flyout | null>(null);
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

  const displayName = formatDisplayName(user?.firstName, user?.lastName, user?.email);
  const initials = formatInitials(user?.firstName, user?.lastName, user?.email);
  const pendingMail = counts
    ? counts.inbox.unread + counts.archived.unread + counts.junk.unread + counts.trash.unread
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

      {/* 2. Árbol de Navegación Principal */}
      <nav
        className={`flex-1 overflow-y-auto overflow-x-hidden py-3 ${
          collapsed ? "flex flex-col items-center gap-2 px-2" : "px-3 space-y-4"
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
                className={`group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-edge transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-line-strong ${
                  isGroupActive(group)
                    ? "bg-canvas border border-line-strong/70 text-ink shadow-2xs font-semibold"
                    : "text-subtle hover:bg-canvas/75 hover:text-ink border border-transparent active:scale-95"
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
              <div className="flex items-center justify-between px-3 pb-1.5">
                <span className="flex items-center gap-1.5 font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-subtle/85">
                  <group.icon className="h-3 w-3 text-subtle" />
                  {group.label}
                </span>
                {group.label === "Correo" && pendingMail > 0 && (
                  <span className="font-heading text-[10px] font-bold tabular-nums text-brand-red">
                    {pendingMail} pendientes
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {visibleChildren(group).map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    end={child.end}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-2.5 rounded-edge px-2.5 py-1.5 text-[13px] transition-all duration-150 outline-none ${
                        isActive
                          ? "bg-canvas border border-line-strong/70 text-ink font-heading font-semibold shadow-2xs"
                          : "text-[#4e4e56] hover:bg-canvas/75 hover:text-ink border border-transparent hover:border-line-soft/80"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Micro-contenedor del icono */}
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-edge transition-all duration-150 ${
                            isActive
                              ? "bg-white text-ink border border-line/80 shadow-2xs"
                              : "text-subtle group-hover:text-ink"
                          }`}
                        >
                          <child.icon className="h-3.5 w-3.5" />
                        </div>

                        {/* Etiqueta del módulo o carpeta */}
                        <span className="min-w-0 flex-1 truncate transition-colors duration-150">
                          {child.label}
                        </span>

                        {/* Badge de conteo numérico */}
                        {child.folder && counts && (
                          <FolderBadge count={counts[child.folder]} isActive={isActive} />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
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
          className="animate-plf-toast-in fixed z-40 w-[210px] rounded-edge border border-line bg-white/98 p-1.5 shadow-[0_8px_24px_-4px_rgba(27,27,29,0.14),0_2px_6px_rgba(27,27,29,0.04)] backdrop-blur-md"
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
            {visibleChildren(flyout.group).map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                end={child.end}
                onClick={() => setFlyout(null)}
                className={({ isActive }) =>
                  `group flex items-center gap-2 rounded-edge px-2.5 py-1.5 text-[12.5px] transition-colors ${
                    isActive
                      ? "bg-canvas border border-line-strong/70 text-ink font-heading font-semibold shadow-2xs"
                      : "text-[#4e4e56] hover:bg-canvas/75 hover:text-ink border border-transparent"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-edge transition-colors ${
                        isActive
                          ? "bg-white text-ink border border-line/80 shadow-2xs"
                          : "text-subtle group-hover:text-ink"
                      }`}
                    >
                      <child.icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="truncate flex-1">{child.label}</span>
                    {child.folder && counts && (
                      <FolderBadge count={counts[child.folder]} isActive={isActive} />
                    )}
                  </>
                )}
              </NavLink>
            ))}
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
              className="animate-plf-toast-in absolute bottom-[calc(100%+8px)] left-0 z-30 w-full min-w-[240px] rounded-edge border border-line bg-white/98 p-1.5 shadow-[0_12px_32px_-6px_rgba(27,27,29,0.16),0_2px_8px_rgba(27,27,29,0.06)] backdrop-blur-md"
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
