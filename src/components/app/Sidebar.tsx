import { ChevronDown, Inbox, KeyRound, LogOut, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { Logo } from "../Logo";
import { ChangePasswordModal } from "./ChangePasswordModal";

interface NavItem {
  label: string;
  to: string;
}

interface NavGroup {
  label: string;
  icon: typeof Inbox;
  /** Un item propio (Bandeja) o una familia de sub-secciones (Personal). */
  to?: string;
  children?: NavItem[];
}

/** Arbol de navegacion del panel. El resto del sistema (Reportes, Calidad,
 * Clientes) entra aqui sin tocar el layout. */
const groups: NavGroup[] = [
  { label: "Bandeja", icon: Inbox, to: "/bandeja" },
  {
    label: "Personal",
    icon: Users,
    children: [
      { label: "Colaboradores", to: "/staff" },
      { label: "Roles", to: "/roles" },
    ],
  },
];

const linkBase =
  "flex items-center gap-2.5 rounded-edge px-3 py-2 text-[13px] font-medium transition-colors";
const linkInactive = "text-brand-gray hover:bg-fill hover:text-ink";
const linkActive = "bg-brand-red/8 font-semibold text-brand-red-dark";

/**
 * Barra lateral fija (240 px): logotipo, arbol de modulos y, al pie, la
 * persona conectada. Reemplaza la vieja pareja TopBar + ModuleTabs: toda la
 * navegacion vive en un solo lugar.
 */
export function Sidebar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const local = user?.email.split("@")[0] ?? "";
  const initials = local.slice(0, 2).toUpperCase() || "PF";

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-line bg-white">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo height={22} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-1">
        {groups.map((group) =>
          group.children ? (
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
                    className={({ isActive }) => `${linkBase} pl-9 ${isActive ? linkActive : linkInactive}`}
                  >
                    {child.label}
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
            className={`flex w-full items-center gap-2.5 rounded-edge py-1.5 pl-1.5 pr-2 transition-colors
              ${menuOpen ? "bg-fill" : "hover:bg-fill"}`}
          >
            <span
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-ink
                font-heading text-[12px] font-semibold text-white"
            >
              {initials}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[12.5px] font-semibold leading-tight text-ink">
                {local}
              </span>
              <span className="block truncate text-[11px] leading-tight text-faint">
                {user?.isAdmin ? "Administrador" : "Staff"}
              </span>
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-faint transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </aside>
  );
}
