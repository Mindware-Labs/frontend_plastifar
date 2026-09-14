import type { ReactNode } from "react";

interface BadgeProps {
  /** red = privilegio/vencido; amber = por vencer; green/completed = propio del cliente o cumplido; slate = pausado; neutral = base; white = fondo blanco con borde neutro; red-solid = rojo institucional con fondo sólido. */
  /** `warn` es el ambar de Calidad y Reportes: se conserva porque esas
   pantallas lo usan para «pendiente», que no es ni error ni exito. */
  tone?: "neutral" | "red" | "green" | "warn" | "amber" | "slate" | "completed" | "white" | "red-solid";
  className?: string;
  title?: string;
  children: ReactNode;
}

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-zinc-100/80 text-zinc-700 border border-zinc-200/60",
  red: "bg-red-50 text-red-700 border border-red-200/60",
  "red-solid": "bg-brand-red text-white border border-brand-red",
  green: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  amber: "bg-amber-50 text-amber-800 border border-amber-200/60",
  // Mismo ambar que `amber`: `warn` es como lo nombran Calidad y Reportes.
  warn: "bg-amber-50 text-amber-800 border border-amber-200/60",
  slate: "bg-slate-50 text-slate-700 border border-slate-200/60",
  white: "bg-white text-zinc-500 border border-zinc-200",
};

/** Pastilla de categoría: 20 px de alto, radio de 6 px, sin sombra, en la voz de titular. */
export function Badge({ tone = "neutral", className = "", title, children }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex h-5 items-center whitespace-nowrap rounded-md px-1.5
        font-heading text-[10.5px] font-bold leading-none ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
