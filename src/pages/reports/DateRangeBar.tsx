import { Download } from "lucide-react";
import { useId } from "react";
import { Button } from "../../components/ui/Button";
import { ControlInput } from "../../components/ui/ControlInput";
import { CriteriaField } from "../../components/ui/CriteriaField";
import type { DateRange } from "../../types/reports";
import { MAX_RANGE_MONTHS, maxToFor, minFromFor } from "./useDateRange";

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
 *
 * El tope de 12 meses se aplica en los propios selectores en vez de esperar al
 * rechazo del endpoint: la seccion 4.2 pide que las dos partes digan lo mismo,
 * y un limite que solo se conoce al recibir un aviso rojo obliga a adivinar
 * cual de las dos fechas hay que mover. Espejo de
 * `ReportsController.ParseRange`.
 */
export function DateRangeBar({ range, onChange, onExport }: DateRangeBarProps) {
  // Ids propios: dos barras en una misma pantalla duplicaban "reporte-desde" y
  // la segunda etiqueta apuntaba al primer input.
  const id = useId();
  const fromId = `${id}-desde`;
  const toId = `${id}-hasta`;
  const hintId = `${id}-tope`;

  return (
    <div className="mb-4 flex flex-wrap items-end gap-2">
      <CriteriaField label="Desde" htmlFor={fromId}>
        <ControlInput
          id={fromId}
          type="date"
          value={range.from}
          min={minFromFor(range.to)}
          max={range.to}
          aria-describedby={hintId}
          onChange={(event) => onChange({ ...range, from: event.target.value })}
        />
      </CriteriaField>

      <CriteriaField label="Hasta" htmlFor={toId}>
        <ControlInput
          id={toId}
          type="date"
          value={range.to}
          min={range.from}
          max={maxToFor(range.from)}
          aria-describedby={hintId}
          onChange={(event) => onChange({ ...range, to: event.target.value })}
        />
      </CriteriaField>

      <span id={hintId} className="self-center pb-2 text-[11.5px] text-faint">
        Máximo {MAX_RANGE_MONTHS} meses por consulta.
      </span>

      {onExport && (
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onExport}>
          <Download className="h-[15px] w-[15px]" />
          Exportar CSV
        </Button>
      )}
    </div>
  );
}
