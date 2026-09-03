import { ChevronDown, KeyRound, LogOut, Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/useAuth";
import { ChangePasswordModal } from "./ChangePasswordModal";

interface TopBarProps {
  /** Abre el panel de modulos superpuesto; solo existe por debajo de lg. */
  onOpenMenu: () => void;
}

/**
 * Cabecera global (64 px) del panel interno: en escritorio, solo el menu de
 * la persona conectada — el logotipo y la navegacion de modulos viven en el
 * Sidebar. Por debajo de lg aparece el disparador del panel superpuesto.
 */
export function TopBar({ onOpenMenu }: TopBarProps) {
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
    <header className="flex h-16 items-center gap-4 border-b border-line bg-white px-4 sm:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir menú de módulos"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-edge text-muted
          outline-none transition-colors hover:bg-fill hover:text-ink focus-visible:ring-3
          focus-visible:ring-brand-red/25 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1" />

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`flex items-center gap-2.5 rounded-edge py-1 pl-1 pr-1.5 outline-none
            transition-colors focus-visible:ring-3 focus-visible:ring-brand-red/25
            ${menuOpen ? "bg-fill" : "hover:bg-fill"}`}
        >
          <span
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-ink
              font-heading text-[12px] font-semibold text-white"
          >
            {initials}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-[12.5px] font-semibold leading-tight text-ink">{local}</span>
            <span className="block text-[11px] leading-tight text-faint">
              {user?.isAdmin ? "Administrador" : "Staff"}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-faint" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="animate-plf-toast-in absolute right-0 top-[46px] z-20 w-56 rounded-edge border border-line
              bg-white p-1.5 shadow-[0_4px_8px_rgba(27,27,29,0.04),0_24px_48px_-20px_rgba(27,27,29,0.22)]"
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
                text-brand-gray outline-none transition-colors hover:bg-fill hover:text-ink
                focus-visible:bg-fill focus-visible:text-ink"
            >
              <KeyRound className="h-4 w-4" />
              Cambiar contraseña
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => logout()}
              className="flex w-full items-center gap-2.5 rounded-edge px-2.5 py-2 text-left text-[13px]
                font-medium text-brand-red-dark outline-none transition-colors hover:bg-red-50
                focus-visible:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </header>
  );
}
