import type { ReactNode } from "react";

interface DashboardCardProps {
  /** sm = tiles compactos (KPI); default = paneles con titulo y contenido. */
  padding?: "default" | "sm";
  className?: string;
  children: ReactNode;
}

const paddingClass: Record<NonNullable<DashboardCardProps["padding"]>, string> = {
  default: "p-5",
  sm: "p-4",
};

/**
 * EXCEPCION DE DISENO, deliberada y acotada a este modulo: el resto del panel
 * sigue el sistema plano de DESIGN.md (sin tarjeta, sin sombra, radio de 2px).
 * El Dashboard, por pedido explicito, adopta un lenguaje de tarjetas con
 * sombra suave y radio mayor — nunca uses esto fuera de src/pages/dashboard.
 * Ver DESIGN.md, seccion "Charts (Dashboard)".
 */
export function DashboardCard({ padding = "default", className = "", children }: DashboardCardProps) {
  return (
    <div
      className={`rounded-2xl border border-line-soft bg-white shadow-[0_1px_2px_rgba(27,27,29,0.04),0_8px_24px_-12px_rgba(27,27,29,0.10)] ${paddingClass[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
