import { Check, Clock, ListTodo, Slash, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../../components/ui/Badge";
import type { FilterOption } from "../../components/ui/FilterDropdown";
import type { SelectOption } from "../../components/ui/Select";
import type { TaskStatus } from "../../types/tasks";

const statusLabel: Record<string, string> = {
  Pendiente: "Pendiente",
  EnProgreso: "En progreso",
  Completada: "Completada",
  Cancelada: "Cancelada",
};

export function taskStatusLabel(status: TaskStatus | string) {
  return statusLabel[status] ?? status;
}

export function getTaskStatusIcon(status: TaskStatus | string, className = "size-3"): ReactNode {
  switch (status) {
    case "Pendiente":
      return <Clock aria-hidden className={`${className} text-zinc-400`} strokeWidth={2} />;
    case "EnProgreso":
    case "En progreso":
      return <Timer aria-hidden className={`${className} text-amber-600`} strokeWidth={2} />;
    case "Completada":
      return <Check aria-hidden className={`${className} text-emerald-600`} strokeWidth={2.5} />;
    case "Cancelada":
      return <Slash aria-hidden className={`${className} text-zinc-400`} strokeWidth={2} />;
    default:
      return <ListTodo aria-hidden className={`${className} text-zinc-400`} strokeWidth={2} />;
  }
}

/** Pastillas de estado con icono distintivo para cada estado. */
export function TaskStatusCell({ status }: { status: TaskStatus | string }) {
  if (status === "Completada") {
    return (
      <Badge tone="completed" className="gap-1.5 px-2">
        <Check aria-hidden className="size-3 text-emerald-600" strokeWidth={2.5} />
        Completada
      </Badge>
    );
  }
  if (status === "Cancelada") {
    return (
      <Badge tone="neutral" className="gap-1.5 px-2 text-zinc-500">
        <Slash aria-hidden className="size-3 text-zinc-400" strokeWidth={2} />
        Cancelada
      </Badge>
    );
  }
  if (status === "EnProgreso" || status === "En progreso") {
    return (
      <Badge tone="amber" className="gap-1.5 px-2">
        <Timer aria-hidden className="size-3 text-amber-600" strokeWidth={2} />
        En progreso
      </Badge>
    );
  }

  return (
    <Badge tone="neutral" className="gap-1.5 px-2 text-zinc-600">
      <Clock aria-hidden className="size-3 text-zinc-400" strokeWidth={2} />
      {taskStatusLabel(status)}
    </Badge>
  );
}

/** Opciones con iconos para el selector de filtro por estado de tareas. */
export const TASK_STATUS_FILTER_OPTIONS: FilterOption[] = [
  {
    value: "todos",
    label: "Todos los estados",
    icon: <ListTodo className="h-3.5 w-3.5 text-zinc-400" />,
  },
  {
    value: "Pendiente",
    label: "Pendiente",
    icon: <Clock className="h-3.5 w-3.5 text-zinc-400" />,
  },
  {
    value: "EnProgreso",
    label: "En progreso",
    icon: <Timer className="h-3.5 w-3.5 text-amber-500" />,
  },
  {
    value: "Completada",
    label: "Completada",
    icon: <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />,
  },
  {
    value: "Cancelada",
    label: "Cancelada",
    icon: <Slash className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} />,
  },
];

/** Opciones con iconos para seleccionar el estado al editar la tarea. */
export const TASK_STATUS_EDIT_OPTIONS: SelectOption[] = [
  {
    value: "Pendiente",
    label: "Pendiente",
    icon: <Clock className="h-3.5 w-3.5 text-zinc-400" />,
  },
  {
    value: "EnProgreso",
    label: "En progreso",
    icon: <Timer className="h-3.5 w-3.5 text-amber-500" />,
  },
];
