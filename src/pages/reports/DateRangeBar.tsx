import { Download } from "lucide-react";
import { Button } from "../../components/ui/Button";
import type { DateRange } from "../../types/reports";

interface DateRangeBarProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
  onExport?: () => void;
}

/** Barra de criterios comun a todo reporte: rango de fechas obligatorio y
 *  exportacion a CSV del resultado tal como se ve (seccion 11.3). */
export function DateRangeBar({ range, onChange, onExport }: DateRangeBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="font-heading text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
          Desde
        </span>
        <input
          type="date"
          value={range.from}
          max={range.to}
          onChange={(event) => onChange({ ...range, from: event.target.value })}
          className="h-8 rounded-edge border border-line-strong bg-white px-2.5 text-[12.5px] text-ink
            outline-none transition-colors hover:border-zinc-400 focus:border-brand-red focus:ring-3
            focus:ring-brand-red/10"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-heading text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
          Hasta
        </span>
        <input
          type="date"
          value={range.to}
          min={range.from}
          onChange={(event) => onChange({ ...range, to: event.target.value })}
          className="h-8 rounded-edge border border-line-strong bg-white px-2.5 text-[12.5px] text-ink
            outline-none transition-colors hover:border-zinc-400 focus:border-brand-red focus:ring-3
            focus:ring-brand-red/10"
        />
      </label>

      {onExport && (
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onExport}>
          <Download className="h-[15px] w-[15px]" />
          Exportar CSV
        </Button>
      )}
    </div>
  );
}
