import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "./Badge";
import type { HeaderTagTone } from "./HeaderTag";

type BadgeTone = NonNullable<Parameters<typeof Badge>[0]["tone"]>;

export interface StatusStyle {
  tone: BadgeTone;
  icon: LucideIcon;
}

/** Cómo se pinta cada estado de un módulo: su tono y su icono. */
export type StatusStyles<S extends string> = Record<S, StatusStyle>;

/** Pastilla con icono delante. Icono siempre junto a la etiqueta: ningún estado se distingue solo por color. */
export function IconBadge({ tone, icon: Icon, title, children }: StatusStyle & { title?: string; children: ReactNode }) {
  return (
    <Badge tone={tone} title={title}>
      <span className="inline-flex items-center gap-1.5">
        <Icon aria-hidden className="h-3 w-3" />
        {children}
      </span>
    </Badge>
  );
}

/** La pastilla de un estado según el mapa del módulo. La etiqueta es el propio estado. */
export function StatusBadge<S extends string>({ status, styles }: { status: S; styles: StatusStyles<S> }) {
  return <IconBadge {...styles[status]}>{status}</IconBadge>;
}

const CHIP_TONE: Record<BadgeTone, HeaderTagTone> = {
  neutral: "neutral",
  slate: "neutral",
  white: "neutral",
  completed: "emerald",
  green: "emerald",
  warn: "amber",
  amber: "amber",
  red: "red",
  "red-solid": "red",
};

/**
 * Tono del filtro de cabecera (HeaderTag) para un estado. Se deriva del mismo
 * mapa que pinta la pastilla, para que el filtro y la fila nunca discrepen.
 */
export function chipToneOf<S extends string>(styles: StatusStyles<S>, status: S): HeaderTagTone {
  return CHIP_TONE[styles[status].tone];
}
