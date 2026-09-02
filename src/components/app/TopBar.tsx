import { ChevronDown, LogOut, Search, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "../Logo";
import { useAuth } from "../../context/AuthContext";

interface TopBarProps {
  search: string;
  onSearchChange: (value: string) => void;
}

/**
 * Cabecera global (64 px) del panel interno, segun el lienzo
 * design/dashboard/Main.dc.html: logotipo, buscador global, y menu de la
 * persona conectada. Sin controles decorativos: todo lo que se ve, funciona.
 */
export function TopBar({ search, onSearchChange }: TopBarProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
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
    <header className="flex h-16 items-center gap-7 border-b border-line bg-white px-8">
      <Logo height={24} className="shrink-0" />

      <label
        className="flex h-[38px] max-w-[420px] flex-1 cursor-text items-center gap-2.5 rounded-edge
          border border-transparent bg-canvas px-3.5 transition-colors
          focus-within:border-brand-red/45 focus-within:bg-white focus-within:ring-3 focus-within:ring-brand-red/8"
      >
        <Search className="h-4 w-4 shrink-0 text-faint" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nombre o correo…"
          aria-label="Buscar"
          className="w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-zinc-400"
        />
      </label>

      <div className="flex-1" />

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`flex items-center gap-2.5 rounded-edge py-1 pl-1 pr-1.5 transition-colors
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
            <span className="flex items-center gap-2.5 rounded-edge px-2.5 py-2 text-[13px] text-zinc-400">
              <User className="h-4 w-4" />
              Mi perfil
              <span className="ml-auto text-[10px] uppercase tracking-wide">Pronto</span>
            </span>
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
      </div>
    </header>
  );
}
