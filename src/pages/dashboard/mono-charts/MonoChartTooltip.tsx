// Adaptado de DitherChartTooltipContent —
// https://github.com/Subhan-code/Amicro--Micro-transitions- (MIT). Recoloreado
// al vocabulario propio del panel (panel flotante blanco, no el tema oscuro
// original) para que combine con el resto del Dashboard.
import type { ReactNode } from "react";

export interface MonoChartTooltipProps {
  active?: boolean;
  payload?: { color?: string; fill?: string; value?: number | string; name?: string; dataKey?: string }[];
  label?: string;
  indicator?: "dot" | "line";
  formatter?: (value: number | string | undefined, name: string | undefined) => ReactNode;
}

export function MonoChartTooltip({ active, payload, label, indicator = "dot", formatter }: MonoChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-edge border border-line bg-white px-3 py-2 text-xs shadow-[0_4px_8px_rgba(27,27,29,0.04),0_24px_48px_-20px_rgba(27,27,29,0.28)]">
      {label && (
        <div className="mb-1.5 border-b border-line-soft pb-1 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
          {label}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((item, idx) => {
          const color = item.color || item.fill || "var(--color-brand-red)";
          const valueDisplay = formatter
            ? formatter(item.value, item.name)
            : typeof item.value === "number"
              ? item.value.toLocaleString()
              : item.value;

          return (
            <div key={idx} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {indicator === "dot" ? (
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                ) : (
                  <span className="h-0.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                )}
                <span className="font-normal text-brand-gray">{item.name || item.dataKey}:</span>
              </div>
              <span className="font-semibold tabular-nums text-ink">{valueDisplay}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
