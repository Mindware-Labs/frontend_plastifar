import type { ReactNode } from "react";

interface BadgeProps {
  /** red = privilegio/vencido; amber = por vencer; green/completed = propio del cliente o cumplido; slate = pausado; neutral = base. */
  tone?: "neutral" | "red" | "green" | "amber" | "slate" | "completed";
  className?: string;
  children: ReactNode;
}

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-zinc-100/80 text-zinc-700 border border-zinc-200/60",
  red: "bg-red-50 text-brand-red border border-red-200/60",
  green: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  amber: "bg-amber-50 text-amber-800 border border-amber-200/60",
  slate: "bg-slate-50 text-slate-700 border border-slate-200/60",
};

/** Pastilla de categoría moderna y compacta: 20 px de alto, bordes redondeados y contorno sutil. */
export function Badge({ tone = "neutral", className = "", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex h-5 items-center whitespace-nowrap rounded-md px-1.5
        text-[10.5px] font-semibold tracking-tight shadow-2xs ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
