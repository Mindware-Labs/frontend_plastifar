import { ChevronDown, Inbox, KeyRound, LogOut, PanelLeft, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useEmailCounts } from "../../context/useEmailCounts";
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
}

interface NavGroup {
  label: string;
  icon: typeof Inbox;
  /** Un item propio (Bandeja) o una familia de sub-secciones (Personal). */
  to?: string;
  children?: NavItem[];
}

/** Arbol de navegacion del panel: los modulos nuevos entran aqui sin tocar el layout. */
const groups: NavGroup[] = [
  {
    label: "Correo",
    icon: Inbox,
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
      { label: "Colaboradores", to: "/staff" },
      { label: "Roles", to: "/roles" },
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
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
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

      <nav
        className={`flex-1 overflow-y-auto overflow-x-hidden py-1 ${
          collapsed ? "flex flex-col items-center gap-1 px-2" : "px-3"
        }`}
      >
        {groups.map((group) =>
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
            <div key={group.label} className="mt-5 first:mt-0">
              <div
                className="flex items-center gap-2.5 px-3 pb-1.5 font-heading text-[10px] font-semibold
                  uppercase tracking-[0.1em] text-faint"
              >
                <group.icon className="h-[13px] w-[13px]" />
                {group.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.children.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    end={child.end}
                    className={({ isActive }) => `${linkBase} pl-9 ${isActive ? linkActive : linkInactive}`}
                  >
                    {child.label}
                    {child.folder && counts && <FolderBadge count={counts[child.folder]} />}
                  </NavLink>
                ))}
              </div>
            </div>
          ) : (
            <NavLink
              key={group.to}
              to={group.to!}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
            >
              <group.icon className="h-4 w-4" />
              {group.label}
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
