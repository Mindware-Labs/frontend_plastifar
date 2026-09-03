import type { PriorityCompliance } from "../../types/dashboard";

function tone(value: number): string {
  if (value >= 90) return "bg-brand-green";
  if (value >= 75) return "bg-warn";
  return "bg-brand-red";
}

interface PriorityBarsProps {
  rows: PriorityCompliance[];
}

export function PriorityBars({ rows }: PriorityBarsProps) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.priority} className="flex items-center gap-2">
          <span className="w-[64px] shrink-0 truncate text-[11px] text-muted">{row.priority}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
            <div className={`h-full rounded-full ${tone(row.compliance)}`} style={{ width: `${row.compliance}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-faint">
            {row.compliance}%
          </span>
        </div>
      ))}
    </div>
  );
}
