import type { ReactNode } from "react";

interface BadgeProps {
  /** red = privilegio/vencido; amber = por vencer; green = propio del cliente; slate = pausado; neutral = base. */
  tone?: "neutral" | "red" | "green" | "amber" | "slate";
  children: ReactNode;
}

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-fill text-brand-gray",
  red: "bg-brand-red/8 text-brand-red-dark",
  green: "bg-brand-green/8 text-brand-green",
  amber: "bg-amber-500/10 text-amber-800",
  slate: "bg-slate-500/10 text-slate-600",
};

/** Pastilla de categoria en tablas: 22 px de alto, sin borde, fondo al 8 %. */
export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2.5
        text-[11.5px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
