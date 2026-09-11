import type { ReactNode } from "react";

interface BadgeProps {
  /**
   * red = privilegio/critico/vencido; green = propio/sano; neutral = base.
   * warn y su alias amber = "todavia no" (pendiente, por vencer); slate = pausado.
   */
  tone?: "neutral" | "red" | "green" | "warn" | "amber" | "slate";
  children: ReactNode;
}

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-fill text-brand-gray",
  red: "bg-brand-red/8 text-brand-red-dark",
  green: "bg-brand-green/8 text-brand-green",
  warn: "bg-warn/8 text-warn",
  // `amber` es el nombre que usa Bandeja para el mismo rol que `warn`. Se mapea
  // al token del sistema en vez de a la paleta de fabrica de Tailwind: un solo
  // ambar en el panel, y el que ya cumple el piso de contraste.
  amber: "bg-warn/8 text-warn",
  slate: "bg-fill text-subtle",
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
