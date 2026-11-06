import { AlertOctagon, AlertTriangle, CheckCircle2, Clock, Flag } from "lucide-react";
import type { FilterOption } from "../components/ui/FilterDropdown";

export const priorityFilterDefaultIcon = <Flag className="h-4 w-4 text-zinc-500" />;

/** Opciones del filtro de prioridad (tickets, SLA, motivos, tareas). */
export function priorityFilterOptions(iconClass = "h-4 w-4", allValue = "todas"): FilterOption[] {
  return [
    {
      value: allValue,
      label: "Todas las prioridades",
      icon: <Flag className={`${iconClass} text-zinc-500`} />,
    },
    {
      value: "Emergencia",
      label: "Emergencia",
      icon: <AlertOctagon className={`${iconClass} text-brand-red`} />,
    },
    {
      value: "Alta",
      label: "Alta",
      icon: <AlertTriangle className={`${iconClass} text-amber-500`} />,
    },
    {
      value: "Normal",
      label: "Normal",
      icon: <CheckCircle2 className={`${iconClass} text-zinc-500`} />,
    },
    {
      value: "Baja",
      label: "Baja",
      icon: <Clock className={`${iconClass} text-zinc-400`} />,
    },
  ];
}
