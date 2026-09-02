import { LogOut, ShieldCheck, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { Logo } from "../components/Logo";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/staff", label: "Personal", icon: Users },
  { to: "/roles", label: "Roles", icon: ShieldCheck },
];

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <aside className="flex w-60 flex-col bg-white border-r border-zinc-200">
        <div className="flex h-16 items-center border-b border-zinc-200 px-6">
          <Logo className="text-lg" />
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-red/10 text-brand-red"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`
              }
            >
              <Icon className="h-4.5 w-4.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-zinc-200 p-4">
          <div className="mb-3 px-1">
            <p className="truncate text-sm font-medium text-zinc-900">{user?.email}</p>
            <p className="text-xs text-zinc-500">{user?.isAdmin ? "Administrador" : "Staff"}</p>
          </div>
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
              text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-brand-red"
          >
            <LogOut className="h-4.5 w-4.5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
