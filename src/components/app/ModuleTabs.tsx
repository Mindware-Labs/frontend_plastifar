import { Users } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

/**
 * Barra de modulos (47 px). Hoy solo existe Personal; el resto del sistema
 * (Bandeja, Reportes, Calidad, Clientes) entrara aqui sin mover nada mas.
 */
const modules = [
  { label: "Personal", icon: Users, to: "/staff", match: ["/staff", "/roles"] },
];

export function ModuleTabs() {
  const { pathname } = useLocation();

  return (
    <nav className="flex h-[47px] items-center gap-0.5 border-b border-line bg-white px-[18px]">
      {modules.map(({ label, icon: Icon, to, match }) => {
        const isActive = match.some((path) => pathname.startsWith(path));

        return (
          <NavLink
            key={label}
            to={to}
            className={`flex h-[47px] items-center gap-[7px] whitespace-nowrap border-b-2 px-3.5 text-[13.5px]
              transition-colors ${
                isActive
                  ? "border-brand-red font-semibold text-ink"
                  : "border-transparent font-medium text-muted hover:text-ink"
              }`}
          >
            <Icon className="h-[15px] w-[15px]" />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
