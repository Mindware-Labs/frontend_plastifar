import { Check, Slash } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import type { TaskStatus } from "../../types/tasks";

const statusLabel: Record<TaskStatus, string> = {
  Pendiente: "Pendiente",
  EnProgreso: "En progreso",
  Completada: "Completada",
  Cancelada: "Cancelada",
};

export function taskStatusLabel(status: TaskStatus) {
  return statusLabel[status];
}

/** Pendiente y en progreso llevan punto; los cierres, pastilla. */
export function TaskStatusCell({ status }: { status: TaskStatus }) {
  if (status === "Completada") {
    return (
      <Badge tone="completed" className="gap-1.5 px-2">
        <Check aria-hidden className="size-3" strokeWidth={2.5} />
        Completada
      </Badge>
    );
  }
  if (status === "Cancelada") {
    return (
      <Badge tone="neutral" className="gap-1.5 px-2">
        <Slash aria-hidden className="size-3 text-zinc-400" strokeWidth={2} />
        Cancelada
      </Badge>
    );
  }

  const dot = status === "EnProgreso" ? "bg-amber-500" : "bg-zinc-400";
  return (
    <span className="inline-flex items-center gap-[7px] whitespace-nowrap text-[12.5px] text-brand-gray">
      <span aria-hidden className={`h-[7px] w-[7px] shrink-0 rounded-full ${dot}`} />
      {statusLabel[status]}
    </span>
  );
}
