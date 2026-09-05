interface StatTileProps {
  label: string;
  value: string;
  tone?: "neutral" | "red" | "green" | "warn";
  hint?: string;
}

const toneClasses: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "text-ink",
  red: "text-brand-red",
  green: "text-brand-green",
  warn: "text-warn",
};

/** Tarjeta de indicador: sin sombra ni borde grueso, apoyada solo en el filete
 *  compartido con el resto del panel — el flat-page rule tambien aplica aqui. */
export function StatTile({ label, value, tone = "neutral", hint }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 border border-line-soft px-4 py-3.5">
      <span className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
        {label}
      </span>
      {/* tabular-nums: la cifra cambia con cada recarga y no debe bailar de ancho. */}
      <span
        className={`font-heading text-[20px] font-bold leading-none tracking-[-0.02em] tabular-nums ${toneClasses[tone]}`}
      >
        {value}
      </span>
      {hint && <span className="text-[11.5px] text-muted">{hint}</span>}
    </div>
  );
}
