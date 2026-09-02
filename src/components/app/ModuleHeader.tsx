import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

const sections = [
  { label: "Colaboradores", to: "/staff" },
  { label: "Roles", to: "/roles" },
];

interface ModuleHeaderProps {
  /** Resumen en linea con el titulo, no debajo: gana altura para la tabla. */
  summary?: ReactNode;
  /** Accion principal del modulo, alineada con las pestanas de seccion. */
  action?: ReactNode;
}

export function ModuleHeader({ summary, action }: ModuleHeaderProps) {
  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-heading text-[20px] font-bold tracking-[-0.02em] text-ink">Personal</h1>
        {summary && (
          <>
            <span aria-hidden className="h-3.5 w-px self-center bg-line" />
            <p className="text-[12.5px] text-muted">{summary}</p>
          </>
        )}
      </div>

      <div className="mt-2 flex items-end justify-between gap-4 border-b border-line">
        <div className="flex items-center gap-6">
          {sections.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `-mb-px border-b-2 pb-2 text-[13px] transition-colors ${
                  isActive
                    ? "border-brand-red font-semibold text-ink"
                    : "border-transparent font-medium text-muted hover:text-ink"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        {action && <div className="pb-1.5">{action}</div>}
      </div>
    </div>
  );
}
