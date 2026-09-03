import { HOUR_BLOCKS, WEEKDAYS_SHORT, type HeatmapCell } from "../../types/dashboard";

interface ActivityHeatmapProps {
  cells: HeatmapCell[];
}

/**
 * Secuencial de un solo tono (metodo dataviz): magnitud, no identidad, asi
 * que es una sola escala clara->oscuro sobre el rojo institucional en vez de
 * una paleta categorica. `color-mix` genera los pasos: nunca un hex suelto.
 */
export function ActivityHeatmap({ cells }: ActivityHeatmapProps) {
  const max = Math.max(1, ...cells.map((cell) => cell.count));

  function cellStyle(count: number) {
    const intensity = Math.round((count / max) * 90) + 6; // 6%–96%: nunca blanco puro ni rojo puro
    return { backgroundColor: `color-mix(in srgb, var(--color-brand-red) ${intensity}%, white)` };
  }

  function find(day: (typeof WEEKDAYS_SHORT)[number], block: (typeof HOUR_BLOCKS)[number]) {
    return cells.find((cell) => cell.day === day && cell.block === block)?.count ?? 0;
  }

  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="grid grid-cols-[28px_repeat(6,1fr)] gap-1">
        <span />
        {HOUR_BLOCKS.map((block) => (
          <span key={block} className="text-center text-[10px] leading-tight text-faint">
            {block}
          </span>
        ))}
      </div>

      <div className="grid flex-1 grid-rows-7 gap-1">
        {WEEKDAYS_SHORT.map((day) => (
          <div key={day} className="grid grid-cols-[28px_repeat(6,1fr)] items-stretch gap-1">
            <span className="flex items-center text-[10px] font-medium text-muted">{day}</span>
            {HOUR_BLOCKS.map((block) => {
              const count = find(day, block);
              return (
                <div
                  key={block}
                  title={`${day} ${block}: ${count} tickets`}
                  style={cellStyle(count)}
                  className="rounded-[3px]"
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-1.5 text-[10px] text-faint">
        Menos
        {[15, 35, 55, 75, 95].map((step) => (
          <span
            key={step}
            className="h-2.5 w-2.5 rounded-[2px]"
            style={{ backgroundColor: `color-mix(in srgb, var(--color-brand-red) ${step}%, white)` }}
          />
        ))}
        Más
      </div>
    </div>
  );
}
