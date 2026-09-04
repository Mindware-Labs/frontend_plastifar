import { Download } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { ControlInput } from "../../components/ui/ControlInput";
import { CriteriaField } from "../../components/ui/CriteriaField";
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
      <CriteriaField label="Desde" htmlFor="reporte-desde">
        <ControlInput
          id="reporte-desde"
          type="date"
          value={range.from}
          max={range.to}
          onChange={(event) => onChange({ ...range, from: event.target.value })}
        />
      </CriteriaField>

      <CriteriaField label="Hasta" htmlFor="reporte-hasta">
        <ControlInput
          id="reporte-hasta"
          type="date"
          value={range.to}
          min={range.from}
          onChange={(event) => onChange({ ...range, to: event.target.value })}
        />
      </CriteriaField>

      {onExport && (
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onExport}>
          <Download className="h-[15px] w-[15px]" />
          Exportar CSV
        </Button>
      )}
    </div>
  );
}
