import type { ReactNode } from "react";

interface BadgeProps {
  /** red = privilegio/vencido; amber = por vencer; green/completed = propio del cliente o cumplido; slate = pausado; neutral = base. */
  tone?: "neutral" | "red" | "green" | "amber" | "slate" | "completed";
  className?: string;
  children: ReactNode;
}

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-zinc-100/80 text-zinc-700 border border-zinc-200/60",
  red: "bg-brand-red/[0.06] text-brand-red border border-brand-red/20",
  green: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  amber: "bg-amber-50 text-amber-800 border border-amber-200/60",
  slate: "bg-slate-50 text-slate-700 border border-slate-200/60",
};

/** Pastilla de categoría: 20 px de alto, radio de 6 px, sin sombra, en la voz de titular. */
export function Badge({ tone = "neutral", className = "", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex h-5 items-center whitespace-nowrap rounded-md px-1.5
        font-heading text-[10.5px] font-bold leading-none ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
