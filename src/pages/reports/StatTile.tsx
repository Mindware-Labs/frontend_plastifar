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

/**
 * Tarjeta de indicador.
 *
 * Eran las unicas cifras del panel sin superficie: un filete fino sobre el
 * lienzo tintado, al lado de una tabla que si venia en tarjeta con sombra. Las
 * cuatro cifras se leian como notas al margen de la tabla en vez de como el
 * resumen que encabeza el resultado. Ahora llevan la misma superficie que las
 * fichas del dashboard, que es lo que son.
 */
export function StatTile({ label, value, tone = "neutral", hint }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-line bg-white px-4 py-3.5 shadow-card">
      <span className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
        {label}
      </span>
      {/* tabular-nums: la cifra cambia con cada recarga y no debe bailar de ancho. */}
      <span
        className={`font-heading text-[20px] font-bold leading-none tracking-[-0.02em] tabular-nums ${toneClasses[tone]}`}
      >
        {value}
      </span>
      {hint && <span className="text-[11.5px] text-subtle">{hint}</span>}
    </div>
  );
}
