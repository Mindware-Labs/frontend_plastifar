import { Download } from "lucide-react";
import { useId } from "react";
import { Button } from "../../components/ui/Button";
import { ControlInput } from "../../components/ui/ControlInput";
import { CriteriaField } from "../../components/ui/CriteriaField";
import type { DateRange } from "../../types/reports";

interface DateRangeBarProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
  onExport?: () => void;
}

/**
 * Barra de criterios comun a todo reporte de periodo: rango de fechas
 * obligatorio y exportacion a CSV del resultado tal como se ve (seccion 11.3).
 *
 * Regla de ubicacion del boton Exportar: si el reporte tiene fila de criterios,
 * el boton vive en ella con `ml-auto` -acompaña a lo que acota el resultado-;
 * si el reporte es una foto sin rango (Clientes), vive en la accion del
 * ModuleHeader. Nunca en los dos sitios.
 */
export function DateRangeBar({ range, onChange, onExport }: DateRangeBarProps) {
  // Ids propios: dos barras en una misma pantalla duplicaban "reporte-desde" y
  // la segunda etiqueta apuntaba al primer input.
  const id = useId();
  const fromId = `${id}-desde`;
  const toId = `${id}-hasta`;

  return (
    <div className="mb-4 flex flex-wrap items-end gap-2">
      <CriteriaField label="Desde" htmlFor={fromId}>
        <ControlInput
          id={fromId}
          type="date"
          value={range.from}
          max={range.to}
          onChange={(event) => onChange({ ...range, from: event.target.value })}
        />
      </CriteriaField>

      <CriteriaField label="Hasta" htmlFor={toId}>
        <ControlInput
          id={toId}
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
